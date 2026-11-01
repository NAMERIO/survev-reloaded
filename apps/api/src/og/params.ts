import { MapId, TeamMode } from "@survev/shared/gameConfig.ts";
import {
    ALL_MAPS,
    type LeaderboardRequest,
    zLeaderboardsRequest,
    zUserStatsRequest,
} from "@survev/shared/types/stats.ts";
import type { ZodType } from "zod";

function field<T>(schema: ZodType<T>, value: string | null, fallback: T): T {
    const parsed = schema.safeParse(value);
    return parsed.success ? parsed.data : fallback;
}

/** the leaderboard page's ?type=&team=&t=&mapId=, bad values fall back to the page's defaults */
export function parseLeaderboardParams(query: URLSearchParams): LeaderboardRequest {
    const { type, teamMode, interval, mapId } = zLeaderboardsRequest.shape;
    return {
        type: field(type, query.get("type"), "most_kills"),
        teamMode: field(teamMode, query.get("team"), TeamMode.Solo),
        interval: field(interval, query.get("t"), "daily"),
        mapId: field(mapId, query.get("mapId"), MapId.Main),
    };
}

/** the profile page's ?time=&mapId= */
export function parsePlayerParams(query: URLSearchParams) {
    const { interval, mapIdFilter } = zUserStatsRequest.shape;
    return {
        interval: field(interval, query.get("time"), "alltime"),
        mapIdFilter: field(mapIdFilter, query.get("mapId"), ALL_MAPS),
    };
}
