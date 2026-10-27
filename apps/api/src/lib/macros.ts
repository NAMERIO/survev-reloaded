import { sharedEnv } from "@survev/config/env.ts";
import type { HTTPRateLimit } from "@survev/config/utils/rateLimit.ts";
import { Elysia } from "elysia";
import { Forbidden, InvalidParams, RateLimited } from "./errors.ts";
import { getIp } from "./ip.ts";

/**
 * route options for the checks most routes share.
 * they run on transform, before the body is validated: a request without the api key
 * gets a 403 and not a validation error, and an invalid body still counts against the rate limit
 */
export const macros = new Elysia({ name: "macros" }).macro({
    /** only the game server and the discord bot call these, both send the api key */
    private: {
        transform({ request }) {
            if (request.headers.get("survev-api-key") !== sharedEnv.SURVEV_API_KEY) {
                throw new Forbidden({ message: "Invalid API key" });
            }
        },
    },
    /** routes given the same HTTPRateLimit share its budget */
    rateLimit: (rateLimit: HTTPRateLimit) => ({
        transform({ request, server }) {
            const ip = getIp(request, server);

            if (!ip) {
                throw new InvalidParams({ message: "Invalid IP" });
            }

            if (rateLimit.isRateLimited(ip)) {
                throw new RateLimited({ message: "Rate limited" });
            }
        },
    }),
});
