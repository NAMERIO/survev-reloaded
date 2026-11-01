import { type SaveGameBody, zSaveGameMatchData } from "@survev/contracts";
import { getLogger } from "@survev/logger/node.ts";
import { Elysia } from "elysia";
import { z } from "zod";
import { db } from "../db/index.ts";
import { matchData, type MatchDataTable } from "../db/schema.ts";
import { query } from "../lib/errors.ts";
import { logPlayerIps } from "../moderation/bans.ts";
import { cache } from "./cache.ts";

const logger = getLogger(["api", "stats"]);

// @survev/contracts can't depend on the drizzle schema, so check here that the game's
// save_game payload still fits the match_data insert type
type AssertAssignable<T extends U, U> = T;
type _SaveGameMatchDataFitsTable = AssertAssignable<
    SaveGameBody["matchData"],
    (MatchDataTable & { ip: string; findGameIp: string })[]
>;

/** /private/save_game: the game server saves finished games */
export const StatsPrivateRoutes = new Elysia()
    .post(
        "/save_game",
        { body: z.object({ matchData: zSaveGameMatchData.min(1) }) },
        async ({ body: { matchData: rows } }) => {
            // safe to send again: rows that already exist are skipped, match data and player ips alike
            const saved = await query(() => db.insert(matchData).values(rows).onConflictDoNothing());
            if (saved.isErr()) return saved.error;

            await logPlayerIps(rows);
            await cache.invalidateLeaderboards(rows);
            logger.info("game.saved", { gameId: rows[0].gameId });
            return { message: `Saved ${rows.length} rows` };
        },
    );
