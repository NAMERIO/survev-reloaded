import { getLogger } from "@survev/logger/node.ts";
import { Result, TaggedError } from "better-result";
import { status } from "elysia";

const logger = getLogger(["api", "errors"]);

//
// expected failures, every helper returns these through a Result.
// a route returns (or a hook throws) the error itself, app.ts turns it into the error body
//

export class InvalidParams extends TaggedError("InvalidParams")<{ message: string; issues?: unknown }> {}
export class Unauthorized extends TaggedError("Unauthorized")<{ message: string }> {}
export class Forbidden extends TaggedError("Forbidden")<{ message: string }> {}
export class NotFound extends TaggedError("NotFound")<{ message: string }> {}
export class Conflict extends TaggedError("Conflict")<{ message: string }> {}
export class RateLimited extends TaggedError("RateLimited")<{ message: string }> {}
/** a third party (region, turnstile, proxycheck) failed or timed out */
export class UpstreamError extends TaggedError("UpstreamError")<{ message: string; cause?: unknown }> {}
export class DatabaseError extends TaggedError("DatabaseError")<{ message: string; cause: unknown }> {}

export type ApiError =
    | InvalidParams
    | Unauthorized
    | Forbidden
    | NotFound
    | Conflict
    | RateLimited
    | UpstreamError
    | DatabaseError;

const statusByTag = {
    InvalidParams: 400,
    Unauthorized: 401,
    Forbidden: 403,
    NotFound: 404,
    Conflict: 409,
    RateLimited: 429,
    UpstreamError: 502,
    DatabaseError: 500,
} as const satisfies Record<ApiError["_tag"], number>;

/** the one error body the API sends */
export interface ErrorBody {
    error: ApiError["_tag"] | "InternalError";
    message: string;
    issues?: unknown;
}

export function isApiError(error: unknown): error is ApiError {
    return TaggedError.is(error) && Object.hasOwn(statusByTag, error._tag);
}

/** failures are logged where they happen (query, fetchJson), not here */
export function errorResponse(error: ApiError) {
    return status(
        statusByTag[error._tag],
        {
            error: error._tag,
            message: error.message,
            ...("issues" in error && { issues: error.issues }),
        } satisfies ErrorBody,
    );
}

/** ok: 200 with the value, err: the error, sent as the error body */
export function respond<T>(result: Result<T, ApiError>) {
    return result.isOk() ? result.value : result.error;
}

/** run a query (or transaction), a rejection is logged and becomes a DatabaseError */
export function query<T>(fn: () => Promise<T>, message = "Database query failed") {
    return Result.tryPromise({
        try: fn,
        catch: (cause) => {
            logger.error("db.query_failed", { op: message, err: cause });
            return new DatabaseError({ message, cause });
        },
    });
}

/** like query, a missing row is a NotFound */
export function queryOne<T>(fn: () => Promise<T | undefined>, notFound: string) {
    return query(fn).then(
        Result.andThen((value: T | undefined) =>
            value === undefined ? Result.err(new NotFound({ message: notFound })) : Result.ok(value)
        ),
    );
}
