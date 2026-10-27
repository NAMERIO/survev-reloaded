import { HTTPRateLimit } from "@survev/config/utils/rateLimit.ts";
import { Elysia } from "elysia";
import { macros } from "../lib/macros.ts";
import { leaderboardRoutes } from "./leaderboard.ts";
import { matchDataRoutes } from "./matchData.ts";
import { matchHistoryRoutes } from "./matchHistory.ts";
import { userStatsRoutes } from "./userStats.ts";

export const StatsRoutes = new Elysia({ prefix: "/api" })
    .use(macros)
    // one budget for all stats routes
    .guard({ rateLimit: new HTTPRateLimit(40, 60 * 1000) })
    .use(userStatsRoutes)
    .use(matchHistoryRoutes)
    .use(matchDataRoutes)
    .use(leaderboardRoutes);
