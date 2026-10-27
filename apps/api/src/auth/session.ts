import { getLogger } from "@survev/logger/node.ts";
import { Elysia, type HTTPHeaders } from "elysia";
import { Unauthorized } from "../lib/errors.ts";
import { noteRequest } from "../lib/requestLog.ts";
import { auth, type AuthSession, type AuthUser } from "./auth.ts";

const logger = getLogger(["api", "auth"]);

/** adds the set-cookie headers of a better-auth api call to the response */
export function appendCookies(set: { headers: HTTPHeaders }, headers: Headers | undefined) {
    const cookies = headers?.getSetCookie() ?? [];
    if (cookies.length) {
        set.headers["set-cookie"] = [...(set.headers["set-cookie"] as string[] | undefined ?? []), ...cookies];
    }
}

export const session = new Elysia({ name: "session" })
    .macro({
        /**
         * better-auth's session: `user` / `session`, null when logged out (banned users included).
         * returnHeaders: getSession extends active sessions, the refreshed cookie has to reach the browser too.
         */
        session: {
            async derive({ request, set }) {
                const res = await auth.api
                    .getSession({ headers: request.headers, returnHeaders: true })
                    .catch((err) => void logger.error("auth.session_load_failed", { err }));

                appendCookies(set, res?.headers);
                const user: AuthUser | null = res?.response?.user ?? null;
                const session: AuthSession | null = res?.response?.session ?? null;
                noteRequest(request, { userId: user?.id });
                return { user, session };
            },
        },
    })
    // a second .macro() call: auth builds on session, which types its user / session
    .macro({
        /** like session, 401 when logged out */
        auth: {
            session: true,
            derive({ user, session }) {
                if (!user || !session) {
                    throw new Unauthorized({ message: "Authentication failed" });
                }
                return { user, session };
            },
        },
    });
