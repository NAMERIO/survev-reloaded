import { HTTPRateLimit, WebSocketRateLimit } from "@survev/config/utils/rateLimit.ts";
import type { TeamErrorMsg, TeamMenuErrorType } from "@survev/shared/types/team.ts";
import { Elysia } from "elysia";
import { websocket } from "elysia/websocket";
import { session } from "../../auth/session.ts";
import { getIp, isBehindProxy } from "../../lib/ip.ts";
import { findIpBan } from "../../moderation/bans.ts";
import type { Player } from "./player.ts";
import { teamMenu } from "./teamMenu.ts";

const httpRateLimit = new HTTPRateLimit(5, 2000);
const wsRateLimit = new WebSocketRateLimit(50, 1000, 5);

/** why a socket can't use the team menu, it is told and closed when it opens */
async function rejectReason(ip: string | undefined, userId: string | null): Promise<TeamMenuErrorType | undefined> {
    if (!ip || httpRateLimit.isRateLimited(ip) || wsRateLimit.isIpRateLimited(ip)) return "rate_limited";
    if (await findIpBan(ip)) return "banned";
    if (await isBehindProxy(ip, !userId)) return "behind_proxy";
}

export const TeamMenuRoutes = new Elysia()
    // longer messages close the socket
    .use(websocket({ maxPayloadLength: 1024 }))
    .use(session)
    .guard({ session: true })
    // runs once per socket, before the upgrade. what it returns is on `ws` in every handler
    .derive(async ({ request, server, user }) => {
        const ip = getIp(request, server);
        const userId = user && !user.banned ? user.id : null;
        const connection: { player?: Player; rateLimit: Record<symbol, number> } = { rateLimit: {} };

        return { ip, userId, connection, rejected: await rejectReason(ip, userId) };
    })
    .ws("/team_v2", {
        open(ws) {
            // counted here and not before the upgrade: only an opened socket gets a close
            if (ws.ip) wsRateLimit.ipConnected(ws.ip);

            if (!ws.ip || ws.rejected) {
                const type = ws.rejected ?? "rate_limited";
                ws.send(JSON.stringify({ type: "error", data: { type } } satisfies TeamErrorMsg));
                teamMenu.logger.info("team.socket_rejected", { reason: type });
                ws.close();
                return;
            }
            ws.connection.player = teamMenu.addPlayer(ws, ws.userId, ws.ip);
        },

        message(ws, data) {
            const { player, rateLimit } = ws.connection;
            if (!player || wsRateLimit.isRateLimited(rateLimit)) {
                teamMenu.logger.info("team.rate_limited");
                ws.close();
                return;
            }

            try {
                teamMenu.onMsg(player, data);
            } catch (err) {
                teamMenu.logger.error("team.message_failed", { err });
                ws.close();
            }
        },

        close(ws) {
            if (ws.connection.player) teamMenu.onClose(ws.connection.player);
            if (ws.ip) wsRateLimit.ipDisconnected(ws.ip);
        },
    });
