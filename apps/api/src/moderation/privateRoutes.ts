import type { ModRouterSpectateGameRes, SpectateGamePrivateBody, SpectateGamePrivateRes } from "@survev/contracts";
import { activePassType } from "@survev/shared/defs/gameObjects/passDefs.ts";
import { GameConfig } from "@survev/shared/gameConfig.ts";
import {
    zBanAccountParams,
    zBanIpParams,
    zFindDiscordUserSlugParams,
    zGetPlayerIpParams,
    zGiveXpParams,
    zLogoutFromGameParams,
    zResetPassParams,
    zResetStatsParams,
    zSetAccountNameParams,
    zSetMatchDataNameParams,
    zSpectateGameParams,
    zUnbanAccountParams,
    zUnbanIpParams,
} from "@survev/shared/types/moderation.ts";
import { validateUserName } from "@survev/shared/utils/badWords.ts";
import { util } from "@survev/shared/utils/util.ts";
import { Result } from "better-result";
import { and, eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { z } from "zod";
import { db } from "../db/index.ts";
import { items, matchData, userPasses, users } from "../db/schema.ts";
import { regionFetch, regionIds } from "../game/regions.ts";
import { teamMenu } from "../game/teamMenu.ts";
import { Conflict, InvalidParams, NotFound, query, queryOne, respond } from "../lib/errors.ts";
import { isBehindProxy } from "../lib/ip.ts";
import { incrementPassXp } from "../pass/xp.ts";
import { sanitizeSlug } from "../user/users.ts";
import { banAccount, banInfo, banIps, findIpBan, hashIp, revokeBans, unbanAccount } from "./bans.ts";

const NO_USER = "No user found with that slug.";

function userIdBySlug(slug: string) {
    return queryOne(() => db.query.users.findFirst({ where: { slug }, columns: { id: true, banned: true } }), NO_USER);
}

function ipBanEnd(permanent: boolean, days: number) {
    return permanent ? null : new Date(Date.now() + util.daysToMs(days));
}

function ipBanLength(permanent: boolean, days: number) {
    return permanent ? "permanently" : `for ${days} days`;
}

const moderationRoutes = new Elysia({ prefix: "/moderation" })
    .post("/ban_account", { body: zBanAccountParams }, async ({ body }) => {
        const {
            slug,
            ban_reason: reason,
            executor_id: bannedBy,
            ban_associated_ips,
            ip_ban_duration,
            ip_ban_permanent,
        } = body;

        return respond(
            await Result.gen(async function*() {
                const user = yield* Result.await(queryOne(
                    () =>
                        db.query.users.findFirst({
                            where: { slug },
                            columns: { id: true, banned: true },
                            with: { playerIps: { columns: { ipHash: true, findGameIpHash: true } } },
                        }),
                    NO_USER,
                ));
                if (user.banned) {
                    return Result.err(new Conflict({ message: "User is already banned." }));
                }

                const ipHashes = ban_associated_ips
                    ? user.playerIps.flatMap((row) => [row.ipHash, row.findGameIpHash])
                    : [];

                yield* Result.await(query(() =>
                    db.transaction(async (tx) => {
                        await banAccount(tx, user.id, { reason, bannedBy });
                        await banIps(tx, ipHashes, {
                            reason,
                            bannedBy,
                            expiresAt: ipBanEnd(ip_ban_permanent, ip_ban_duration),
                        });
                    })
                ));

                for (const ipHash of ipHashes) {
                    teamMenu.disconnectPlayers(ipHash);
                }

                const ips = ban_associated_ips
                    ? ` and its IPs ${ipBanLength(ip_ban_permanent, ip_ban_duration)}`
                    : "";
                return Result.ok({ message: `Banned ${slug}'s account${ips}.` });
            }),
        );
    })
    .post("/unban_account", { body: zUnbanAccountParams }, async ({ body }) => {
        const { slug } = body;

        return respond(
            await Result.gen(async function*() {
                const user = yield* Result.await(userIdBySlug(slug));
                if (!user.banned) {
                    return Result.err(new Conflict({ message: "User is not banned." }));
                }
                yield* Result.await(query(() => db.transaction((tx) => unbanAccount(tx, user.id, "admin"))));
                return Result.ok({ message: "User has been unbanned." });
            }),
        );
    })
    .post("/ban_ip", { body: zBanIpParams }, async ({ body }) => {
        const {
            ips,
            is_encoded,
            permanent,
            ban_associated_account,
            ip_ban_duration,
            ban_reason: reason,
            executor_id: bannedBy,
        } = body;

        const ipHashes = is_encoded ? ips : ips.map(hashIp);

        return respond(
            await Result.gen(async function*() {
                // every not-yet-banned account seen on one of these IPs
                const seen = ban_associated_account
                    ? yield* Result.await(query(() =>
                        db.query.playerIps.findMany({
                            where: {
                                OR: [{ ipHash: { in: ipHashes } }, { findGameIpHash: { in: ipHashes } }],
                                user: { banned: false },
                            },
                            columns: { userId: true },
                            with: { user: { columns: { slug: true } } },
                        })
                    ))
                    : [];
                const accounts = new Map<string, string>();
                for (const row of seen) {
                    if (row.userId) accounts.set(row.userId, row.user?.slug ?? row.userId);
                }

                yield* Result.await(query(() =>
                    db.transaction(async (tx) => {
                        await banIps(tx, ipHashes, {
                            reason,
                            bannedBy,
                            expiresAt: ipBanEnd(permanent, ip_ban_duration),
                        });
                        for (const userId of accounts.keys()) {
                            await banAccount(tx, userId, { reason, bannedBy });
                        }
                    })
                ));

                for (const ipHash of ipHashes) {
                    teamMenu.disconnectPlayers(ipHash);
                }

                const target = ipHashes.length === 1 ? `IP ${ipHashes[0]} has` : `IPs: [${ipHashes.join(", ")}] have`;
                let message = `${target} been banned ${ipBanLength(permanent, ip_ban_duration)}.`;
                if (ban_associated_account) {
                    message += accounts.size
                        ? ` Banned ${accounts.size} associated account${accounts.size === 1 ? "" : "s"}: ${
                            [...accounts.values()].join(", ")
                        }.`
                        : " No associated accounts found.";
                }
                return Result.ok({ message });
            }),
        );
    })
    .post("/unban_ip", { body: zUnbanIpParams }, async ({ body }) => {
        const { ip, is_encoded } = body;
        const ipHash = is_encoded ? ip : hashIp(ip);

        return respond(
            await Result.gen(async function*() {
                const revoked = yield* Result.await(
                    query(() => db.transaction((tx) => revokeBans(tx, "ip", [ipHash], "admin"))),
                );
                if (!revoked) {
                    return Result.err(new NotFound({ message: `IP ${ipHash} is not banned.` }));
                }
                return Result.ok({ message: `IP ${ipHash} has been unbanned.` });
            }),
        );
    })
    .post("/get_player_ip", { body: zGetPlayerIpParams }, async ({ body }) => {
        const { name, use_account_slug, game_id } = body;

        return respond(
            await Result.gen(async function*() {
                const rows = yield* Result.await(query(() =>
                    db.query.playerIps.findMany({
                        where: {
                            ...(use_account_slug ? { user: { slug: name } } : { username: name }),
                            ...(game_id && { gameId: game_id }),
                        },
                        columns: {
                            ipHash: true,
                            findGameIpHash: true,
                            username: true,
                            region: true,
                            teamMode: true,
                            createdAt: true,
                            mapId: true,
                        },
                        with: {
                            user: {
                                columns: { slug: true },
                                with: { accounts: { where: { providerId: "discord" }, columns: { accountId: true } } },
                            },
                        },
                        orderBy: { createdAt: "desc" },
                        limit: 10,
                    })
                ));

                if (rows.length === 0) {
                    return Result.err(
                        new NotFound({
                            message: `No IP found for ${name}. Make sure the name matches the one in game.`,
                        }),
                    );
                }

                return Result.ok(rows.map((row) => {
                    const discordId = row.user?.accounts[0]?.accountId ?? null;
                    return {
                        slug: row.user?.slug ?? null,
                        authId: discordId,
                        linkedDiscord: !!discordId,
                        // mods only ever see the hashes
                        ip: row.ipHash,
                        findGameIp: row.findGameIpHash,
                        username: row.username,
                        region: row.region,
                        teamMode: GameConfig.TeamModeToString[row.teamMode],
                        createdAt: row.createdAt,
                        mapId: GameConfig.MapId[row.mapId],
                    };
                }));
            }),
        );
    })
    .post("/clear_all_bans", async () => {
        const revoked = await query(() => db.transaction((tx) => revokeBans(tx, "ip", undefined, "admin")));
        return respond(revoked.map((count) => ({ message: `All IP bans have been cleared (${count}).` })));
    })
    .post(
        // useful for purging bad names from leaderboards
        "/set_match_data_name",
        { body: zSetMatchDataNameParams },
        async ({ body: { current_name, new_name } }) => {
            const res = await query(() =>
                db.update(matchData).set({ username: new_name }).where(eq(matchData.username, current_name))
            );
            return respond(res.map((res) => ({ message: `Updated ${res.count} rows` })));
        },
    )
    .post("/set_account_name", { body: zSetAccountNameParams }, async ({ body }) => {
        const { new_name, current_slug } = body;

        return respond(
            await Result.gen(async function*() {
                const sanitized = validateUserName(new_name);
                if (sanitized.originalWasInvalid) {
                    return Result.err(new InvalidParams({ message: "Invalid new username" }));
                }

                const res = yield* Result.await(query(() =>
                    db
                        .update(users)
                        .set({ username: sanitized.validName, slug: sanitizeSlug(sanitized.validName) })
                        .where(eq(users.slug, current_slug))
                ));
                if (!res.count) {
                    return Result.err(new NotFound({ message: "User not found" }));
                }

                return Result.ok({ message: `updated ${current_slug}'s name to ${sanitized.validName}` });
            }),
        );
    })
    .post(
        "/delete_game",
        {
            body: z.object({
                gameId: z.string(),
            }),
        },
        async ({ body: { gameId } }) => {
            const res = await query(() => db.delete(matchData).where(eq(matchData.gameId, gameId)));
            return respond(res.map((res) => ({ message: `Deleted ${res.count} rows` })));
        },
    )
    .post(
        "/find_discord_user_slug",
        { body: zFindDiscordUserSlugParams },
        async ({ body: { discord_user } }) => {
            const account = await queryOne(
                () =>
                    db.query.accounts.findFirst({
                        where: { providerId: "discord", accountId: discord_user },
                        columns: {},
                        with: { user: { columns: { slug: true } } },
                    }),
                "User not found",
            );
            return respond(account.map(({ user }) => ({ message: `slug: ${user.slug}` })));
        },
    )
    .post("/reset_pass", { body: zResetPassParams }, async ({ body }) => {
        const { slug, pass } = body;
        // default to the active pass
        const passType = pass || activePassType;

        return respond(
            await Result.gen(async function*() {
                const user = yield* Result.await(userIdBySlug(slug));

                yield* Result.await(query(() =>
                    db.transaction(async (tx) => {
                        await tx
                            .delete(userPasses)
                            .where(and(eq(userPasses.userId, user.id), eq(userPasses.passType, passType)));
                        // also remove the pass items from their account
                        await tx
                            .delete(items)
                            .where(and(eq(items.userId, user.id), eq(items.source, passType)));
                    })
                ));

                return Result.ok({ message: `Successfully reset pass for ${slug}` });
            }),
        );
    })
    .post("/give_xp", { body: zGiveXpParams }, async ({ body }) => {
        const { slug, xp } = body;

        return respond(
            await Result.gen(async function*() {
                const user = yield* Result.await(userIdBySlug(slug));
                yield* Result.await(query(() => db.transaction((tx) => incrementPassXp(tx, user.id, xp))));
                return Result.ok({ message: `Successfully gave ${xp} xp to ${slug}` });
            }),
        );
    })
    .post("/logout_from_game", { body: zLogoutFromGameParams }, async ({ body }) => {
        const { slug, game_id } = body;

        return respond(
            await Result.gen(async function*() {
                const user = yield* Result.await(userIdBySlug(slug));

                const res = yield* Result.await(query(() =>
                    db
                        .update(matchData)
                        .set({ userId: null })
                        .where(and(eq(matchData.userId, user.id), eq(matchData.gameId, game_id)))
                ));
                if (!res.count) {
                    return Result.err(new NotFound({ message: `User ${slug} was not found on game ${game_id}` }));
                }

                return Result.ok({ message: `Successfully logged out ${slug} from game ${game_id}.` });
            }),
        );
    })
    .post("/reset_stats", { body: zResetStatsParams }, async ({ body }) => {
        const { slug } = body;

        return respond(
            await Result.gen(async function*() {
                const user = yield* Result.await(userIdBySlug(slug));

                const res = yield* Result.await(
                    query(() => db.update(matchData).set({ userId: null }).where(eq(matchData.userId, user.id))),
                );

                return Result.ok({
                    message: `Successfully reset stats for ${slug} (${res.count} games affected).`,
                });
            }),
        );
    })
    .post("/spectate_player", { body: zSpectateGameParams }, async ({ body, set }) => {
        const { filter } = body;

        if (filter.type === "user_id") {
            // convert the slug to user id
            const user = await userIdBySlug(filter.value);
            if (user.isErr()) return user.error;
            filter.value = user.value.id;
        }

        set.headers["content-type"] = "text/plain; charset=UTF-8";
        set.headers["x-content-type-options"] = "nosniff";
        return spectateRegions(filter);
    });

/** one json line per region, in the order they answer */
async function* spectateRegions(filter: SpectateGamePrivateBody["filter"]) {
    const pending = new Map(
        regionIds().map((regionId) => [
            regionId,
            regionFetch<SpectateGamePrivateRes>(regionId, "api/spectate_game", { filter }).then((res) => ({
                regionId,
                res,
            })),
        ]),
    );

    while (pending.size) {
        const { regionId, res } = await Promise.race(pending.values());
        pending.delete(regionId);
        const line: ModRouterSpectateGameRes = {
            region: regionId,
            done: pending.size === 0,
            ...res.unwrapOr({ players: [] }),
        };
        yield `${JSON.stringify(line)}\n`;
    }
}

/** /private/check_ip is called by the game server, /private/moderation/* by the discord bot */
export const ModerationPrivateRoutes = new Elysia()
    .post(
        "/check_ip",
        {
            body: z.object({
                ip: z.string(),
            }),
        },
        async ({ body: { ip } }) => {
            const ban = await findIpBan(ip);
            if (ban) {
                return { banned: true, banData: banInfo(ban), behindProxy: false };
            }

            const behindProxy = await isBehindProxy(ip, false);
            return { banned: false, banData: undefined, behindProxy };
        },
    )
    .use(moderationRoutes);
