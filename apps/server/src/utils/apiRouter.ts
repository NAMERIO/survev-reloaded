import { treaty } from "@elysia/eden";
import type { PrivateRouteApp } from "@survev/api/types";
import { sharedEnv } from "@survev/config/env.ts";
import { getLogger } from "@survev/logger/node.ts";
import { env } from "../env.ts";

const logger = getLogger(["api-client"]);

export const apiPrivateRouter = treaty<PrivateRouteApp>(env.API_URL, {
    // no retries: quest_progress isn't idempotent,
    // a failed save_game is kept in a lost game file and sent again on startup
    fetcher: ((input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(10_000) })) as typeof fetch,
    headers: {
        "survev-api-key": sharedEnv.SURVEV_API_KEY,
    },
}).private;

export async function checkIp(ip: string) {
    const { data, error } = await apiPrivateRouter.check_ip.post({ ip });
    if (error) {
        logger.error("api.check_ip_failed", { err: error });
        return undefined;
    }
    return data;
}
