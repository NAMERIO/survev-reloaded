import { GIT_VERSION } from "@survev/config/utils/gitRevision.ts";
import { HTTPRateLimit } from "@survev/config/utils/rateLimit.ts";
import { type FindGameResponse, type SiteInfoRes, zFindGameBody } from "@survev/shared/types/api.ts";
import { Elysia, status } from "elysia";
import { randomUUID } from "node:crypto";
import { settings } from "../admin/settings.ts";
import { session } from "../auth/session.ts";
import { env } from "../env.ts";
import { getIp, isBehindProxy, verifyTurnstile } from "../lib/ip.ts";
import { banInfo, findIpBan } from "../moderation/bans.ts";
import { findGame, getFindGamePlayerData, siteRegions } from "./regions.ts";

// not using the macro: rate limited find_game requests get a FindGameResponse
const findGameRateLimit = new HTTPRateLimit(5, 3000);

/** what the client needs to show the play menu and join a game */
export const GameRoutes = new Elysia({ prefix: "/api" })
    .use(session)
    .get("/site_info", (): SiteInfoRes => {
        return {
            modes: [...settings.modes],
            regions: siteRegions(),
            turnstileSiteKey: env.TURNSTILE_SITE_KEY,
            logins: { discord: !!(env.DISCORD_CLIENT_ID && env.DISCORD_SECRET_ID), mock: env.ALLOW_MOCK_ACCOUNT },
            youtube: { name: "", link: "" },
            twitch: [],
            country: "US",
            gitRevision: GIT_VERSION,
            captchaEnabled: settings.captchaEnabled,
            clientTheme: settings.clientTheme,
        };
    })
    .post("/find_game", () => {
        return { error: "invalid_protocol" };
    })
    .post("/find_game_v2", { body: zFindGameBody, session: true }, async ({ body, request, server, ...ctx }) => {
        const ip = getIp(request, server);

        if (!ip) {
            return status(500, { type: "error", error: "invalid_ip" } satisfies FindGameResponse);
        }

        if (findGameRateLimit.isRateLimited(ip)) {
            return status(429, { type: "error", error: "rate_limited" } satisfies FindGameResponse);
        }

        const ban = await findIpBan(ip);
        if (ban) {
            return { type: "banned", ...banInfo(ban) } satisfies FindGameResponse;
        }

        const joinToken = randomUUID();
        // banned accounts can still play, just not as their account
        const user = ctx.user?.banned ? null : ctx.user;

        if (await isBehindProxy(ip, !user)) {
            return { type: "error", error: "behind_proxy" } satisfies FindGameResponse;
        }

        const mode = settings.modes[body.gameModeIdx];
        if (!mode || !mode.enabled) {
            return { type: "error", error: "mode_disabled" } satisfies FindGameResponse;
        }

        if (settings.captchaEnabled && !user) {
            if (!body.turnstileToken) {
                return { type: "error", error: "invalid_captcha" } satisfies FindGameResponse;
            }

            const captcha = await verifyTurnstile(body.turnstileToken, ip);
            if (captcha.isErr()) {
                return status(500, { type: "error", error: "invalid_captcha" } satisfies FindGameResponse);
            }
            if (!captcha.value) {
                return { type: "error", error: "invalid_captcha" } satisfies FindGameResponse;
            }
        }

        const playerData = await getFindGamePlayerData([
            {
                joinToken,
                userId: user?.id || null,
                ip,
            },
        ]);

        const data = await findGame({
            region: body.region,
            version: body.version,
            mapName: mode.mapName,
            teamMode: mode.teamMode,
            autoFill: true,
            playerData,
        });

        if ("error" in data) {
            return { type: "error", error: data.error } satisfies FindGameResponse;
        }

        return {
            type: "success",
            res: {
                joinToken,
                urls: data.urls,
            },
        } satisfies FindGameResponse;
    });
