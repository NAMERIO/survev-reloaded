import { zSetClientThemeBody, zSetGameModeBody } from "@survev/contracts";
import { type MapDefKey, MapDefs } from "@survev/shared/defs/mapDefs.ts";
import { GameObjectDefs } from "@survev/shared/defs/register.ts";
import { TeamMode } from "@survev/shared/gameConfig.ts";
import { zGiveItemParams, zRemoveItemParams } from "@survev/shared/types/moderation.ts";
import { Result } from "better-result";
import { and, eq } from "drizzle-orm";
import { Elysia, status } from "elysia";
import { z } from "zod";
import { MOCK_USER_ID } from "../auth/mockLogin.ts";
import { db } from "../db/index.ts";
import { items, matchData, type MatchDataTable } from "../db/schema.ts";
import { Conflict, InvalidParams, query, queryOne, respond } from "../lib/errors.ts";
import { cache } from "../stats/cache.ts";
import { settings } from "./settings.ts";

/** /private routes the discord bot and admins call */
export const AdminPrivateRoutes = new Elysia()
    .post("/set_game_mode", { body: zSetGameModeBody }, async ({ body }) => {
        const {
            index,
            map_name: mapName,
            team_mode: teamMode,
            enabled,
        } = body;

        if (!MapDefs[mapName as MapDefKey]) {
            return new InvalidParams({ message: "Invalid map name" });
        }

        const set = await settings.setMode(index, { mapName: mapName as MapDefKey, teamMode, enabled });
        if (set.isErr()) return set.error;

        return { message: `Set mode ${index} to ${JSON.stringify(settings.modes[index])}` };
    })
    .post("/set_client_theme", { body: zSetClientThemeBody }, async ({ body: { theme } }) => {
        if (!MapDefs[theme as MapDefKey]) {
            return new InvalidParams({ message: "Invalid map name" });
        }

        const set = await settings.setClientTheme(theme as MapDefKey);
        if (set.isErr()) return set.error;

        return { message: `Set client theme to ${theme}` };
    })
    .post(
        "/toggle_captcha",
        {
            body: z.object({
                enabled: z.boolean(),
            }),
        },
        async ({ body: { enabled } }) => {
            const set = await settings.setCaptchaEnabled(enabled);
            if (set.isErr()) return set.error;

            return { state: enabled, message: `Captcha ${enabled ? "enabled" : "disabled"}` };
        },
    )
    .post(
        "/give_item",
        { body: zGiveItemParams },
        async ({ body: { item, slug, source } }) => {
            if (!GameObjectDefs.typeToDefSafe(item)) {
                return new InvalidParams({ message: "Invalid item type" });
            }

            return respond(
                await Result.gen(async function*() {
                    const user = yield* Result.await(queryOne(
                        () =>
                            db.query.users.findFirst({
                                where: { slug },
                                columns: { id: true },
                                with: { items: { where: { type: item }, columns: { type: true } } },
                            }),
                        "User not found",
                    ));
                    if (user.items.length) {
                        return Result.err(new Conflict({ message: "User already has item" }));
                    }

                    yield* Result.await(
                        query(() =>
                            db.insert(items).values({ userId: user.id, type: item, source, timeAcquired: Date.now() })
                        ),
                    );
                    return Result.ok({ message: `Item "${item}" given to ${slug}` });
                }),
            );
        },
    )
    .post(
        "/remove_item",
        { body: zRemoveItemParams },
        async ({ body: { item, slug } }) => {
            return respond(
                await Result.gen(async function*() {
                    const user = yield* Result.await(queryOne(
                        () => db.query.users.findFirst({ where: { slug }, columns: { id: true } }),
                        "User not found",
                    ));
                    yield* Result.await(
                        query(() => db.delete(items).where(and(eq(items.userId, user.id), eq(items.type, item)))),
                    );
                    return Result.ok({ message: `Item "${item}" removed from ${slug}` });
                }),
            );
        },
    )
    .post("/clear_cache", async () => {
        const removed = await cache.clearCache();
        return { message: `Successfully cleared leaderboard cache (${removed} keys)` };
    })
    .post(
        "/test/insert_game",
        {
            body: z.object({
                kills: z.number().default(1),
            }),
        },
        async ({ body: data }) => {
            if (process.env.NODE_ENV === "production") {
                return status(403, {});
            }

            const row: MatchDataTable = {
                gameId: crypto.randomUUID(),
                userId: MOCK_USER_ID,
                createdAt: new Date(),
                region: "na",
                mapId: 0,
                mapSeed: 9834567801234,
                username: MOCK_USER_ID,
                playerId: 9834,
                teamMode: TeamMode.Solo,
                teamCount: 4,
                teamTotal: 25,
                teamId: 7,
                timeAlive: 842,
                rank: 3,
                died: true,
                damageDealt: 1247,
                damageTaken: 862,
                killerId: 18765,
                killedIds: [
                    12543,
                    13587,
                    14298,
                    15321,
                    16754,
                ],
                ...data,
            };
            await cache.invalidateLeaderboards([row]);
            await db.insert(matchData).values(row);
            return { success: true };
        },
    );
