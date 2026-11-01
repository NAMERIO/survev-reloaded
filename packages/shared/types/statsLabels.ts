import { TeamMode } from "../gameConfig.ts";
import type { LeaderboardRequest, UserStatsRequest } from "./stats.ts";

/** the stats translation key for each filter value; en.json holds the words */
export const LEADERBOARD_TITLE_KEYS = {
    most_kills: "stats-most-kills",
    most_damage_dealt: "stats-most-damage",
    kpg: "stats-kpg-full",
    kills: "stats-total-kills",
    wins: "stats-total-wins",
} as const satisfies Record<LeaderboardRequest["type"], string>;

export const INTERVAL_LABEL_KEYS = {
    daily: "stats-today",
    weekly: "stats-this-week",
    alltime: "stats-all-time",
} as const satisfies Record<UserStatsRequest["interval"], string>;

export const TEAM_MODE_LABEL_KEYS = {
    [TeamMode.Solo]: "stats-solo",
    [TeamMode.Duo]: "stats-duo",
    [TeamMode.Squad]: "stats-squad",
} as const satisfies Record<TeamMode, string>;
