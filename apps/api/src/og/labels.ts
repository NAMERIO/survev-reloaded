import type { TeamMode } from "@survev/shared/gameConfig.ts";
import statsText from "@survev/shared/l10n/stats.en.json";
import type { LeaderboardRequest, UserStatsRequest } from "@survev/shared/types/stats.ts";
import { INTERVAL_LABEL_KEYS, LEADERBOARD_TITLE_KEYS, TEAM_MODE_LABEL_KEYS } from "@survev/shared/types/statsLabels.ts";

type StatKey = Exclude<keyof typeof statsText, "@metadata">;

/** cards use the stats page's own words, in the game font's capitals */
export const statLabel = (key: StatKey) => statsText[key].toUpperCase();

export const leaderboardTitle = (type: LeaderboardRequest["type"]) => statLabel(LEADERBOARD_TITLE_KEYS[type]);

export const intervalLabel = (interval: UserStatsRequest["interval"]) => statLabel(INTERVAL_LABEL_KEYS[interval]);

export const teamModeLabel = (teamMode: TeamMode) => statLabel(TEAM_MODE_LABEL_KEYS[teamMode]);
