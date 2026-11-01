import { HTTPRateLimit } from "@survev/config/utils/rateLimit.ts";
import { getLogger } from "@survev/logger/node.ts";
import { MapDefs } from "@survev/shared/defs/mapDefs.ts";
import { MapId } from "@survev/shared/gameConfig.ts";
import { ALL_MAPS, type LeaderboardRequest } from "@survev/shared/types/stats.ts";
import { Elysia } from "elysia";
import path from "node:path";
import type { ReactElement } from "react";
import { env } from "../env.ts";
import { teamCodeCharacters, teamMenu } from "../game/teamMenu/teamMenu.ts";
import { macros } from "../lib/macros.ts";
import { getLeaderboard } from "../stats/leaderboard.ts";
import { getUserStats } from "../stats/userStats.ts";
import { genericCard } from "./genericCard.tsx";
import { LEADERBOARD_TITLES, leaderboardCard, TEAM_MODE_LABELS } from "./leaderboardCard.tsx";
import { mapArt } from "./maps.ts";
import { injectMeta, type PageMeta } from "./meta.ts";
import { parseLeaderboardParams, parsePlayerParams } from "./params.ts";
import { INTERVAL_LABELS, playerCard } from "./playerCard.tsx";
import { renderCard } from "./render.ts";
import { teamCard } from "./teamCard.tsx";

const logger = getLogger(["api", "og"]);

// its own budget: chat apps fetch previews from a few shared IPs
const rateLimit = new HTTPRateLimit(120, 60 * 1000);

const STATS_MAX_AGE = 600;
const TEAM_MAX_AGE = 60;

async function png(element: Promise<ReactElement> | ReactElement, maxAge: number) {
    return new Response(Buffer.from(await renderCard(await element)), {
        headers: { "content-type": "image/png", "cache-control": `public, max-age=${maxAge}` },
    });
}

/** a failed lookup still answers with a card, crawlers keep whatever they get */
async function attempt<T>(name: string, lookup: () => Promise<T>): Promise<T | undefined> {
    try {
        return await lookup();
    } catch (err) {
        logger.error("og.lookup_failed", { err, name });
        return undefined;
    }
}

const absolute = (pathname: string) => new URL(pathname, env.PUBLIC_URL).toString();

function mapFromFilter(filter: string): MapId | null {
    return filter === ALL_MAPS ? null : Number(filter);
}

const isTeamCode = (code: string) => /^[^/]{1,8}$/.test(code) && [...code].every((c) => teamCodeCharacters.includes(c));

function genericStats() {
    return genericCard({ title: "STATS", subtitle: "Players and leaderboards", label: "stats" });
}

function genericInvite() {
    return genericCard({ title: "JOIN THE FIGHT", subtitle: "Play survev.io with friends", label: "invite" });
}

function teamMapId(mapName: string | undefined) {
    return (mapName && mapName in MapDefs ? MapDefs[mapName as keyof typeof MapDefs].mapId : MapId.Main);
}

async function htmlFile(relativePath: string) {
    const file = Bun.file(path.join(env.WEB_ROOT, relativePath));
    return (await file.exists()) ? file.text() : undefined;
}

const htmlResponse = (html: string) =>
    new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" } });

function leaderboardMeta(params: LeaderboardRequest, search: string): PageMeta {
    const mode = TEAM_MODE_LABELS[params.teamMode];
    const title = `${LEADERBOARD_TITLES[params.type]} · ${mode} · ${INTERVAL_LABELS[params.interval]}`;
    return {
        title: `${title} · survev.io`,
        description: `${mapArt(params.mapId).name} leaderboard on survev.io`,
        image: absolute(`/api/og/leaderboard${search}`),
        url: absolute(`/stats/${search}`),
    };
}

async function playerMeta(slug: string, query: URLSearchParams): Promise<PageMeta> {
    const { interval, mapIdFilter } = parsePlayerParams(query);
    const found = await attempt("player_meta", () => getUserStats({ slug, interval, mapIdFilter }));
    // a banned player gets the generic card, the tags shouldn't name them either
    const stats = found?.banned ? undefined : found;
    const imageQuery = new URLSearchParams({ time: interval, mapId: mapIdFilter });
    return {
        title: `${stats?.username || "Player"} · survev.io stats`,
        description: stats?.username
            ? `${stats.kills.toLocaleString("en-US")} kills and ${stats.wins.toLocaleString("en-US")} wins on survev.io`
            : "Player stats on survev.io",
        image: absolute(`/api/og/player/${encodeURIComponent(slug)}?${imageQuery}`),
        url: absolute(`/stats/?${query}`),
    };
}

export const OgRoutes = new Elysia()
    .use(macros)
    .guard({ rateLimit })
    .get("/api/og/leaderboard", async ({ request }) => {
        const params = parseLeaderboardParams(new URL(request.url).searchParams);
        const rows = await attempt("leaderboard", () => getLeaderboard(params));
        return png(rows?.length ? leaderboardCard({ rows, params }) : genericStats(), STATS_MAX_AGE);
    })
    .get("/api/og/player/:slug", async ({ request, params: { slug } }) => {
        const { interval, mapIdFilter } = parsePlayerParams(new URL(request.url).searchParams);
        const stats = await attempt("player", () => getUserStats({ slug, interval, mapIdFilter }));
        const card = stats?.username && !stats.banned
            ? playerCard({ stats, interval, mapId: mapFromFilter(mapIdFilter) })
            : genericStats();
        return png(card, STATS_MAX_AGE);
    })
    .get("/api/og/team/:code", ({ params: { code } }) => {
        const room = isTeamCode(code) ? teamMenu.roomSummary(code) : undefined;
        const card = room
            ? teamCard({
                code,
                players: room.players,
                maxPlayers: room.maxPlayers,
                region: room.region,
                mapId: teamMapId(room.mapName),
            })
            : genericInvite();
        return png(card, TEAM_MAX_AGE);
    })
    // Caddy only sends /stats/ here when it has a query; the bare page is served as a file
    .get("/stats/", async ({ request, status }) => {
        const query = new URL(request.url).searchParams;
        const html = await htmlFile("stats/index.html");
        if (!html) return status(404);
        const slug = query.get("slug");
        const meta = slug
            ? await playerMeta(slug, query)
            : leaderboardMeta(parseLeaderboardParams(query), query.size ? `?${query}` : "");
        return htmlResponse(injectMeta(html, meta));
    })
    .get("/t/:code", async ({ params: { code }, redirect }) => {
        if (!isTeamCode(code)) return redirect("/");
        const html = await htmlFile("index.html");
        // no built client (dev): vite serves the page, the hash link still joins
        if (!html) return redirect(`/#${code}`);
        const room = teamMenu.roomSummary(code);
        const meta: PageMeta = {
            title: room ? `Join ${room.players[0]} on survev.io` : "Join the fight on survev.io",
            description: room
                ? `${room.players.length} of ${room.maxPlayers} players. Tap to join the team.`
                : "Play survev.io with friends.",
            // the count makes a changed room a new image to chat apps
            image: absolute(`/api/og/team/${code}?n=${room?.players.length ?? 0}`),
            url: absolute(`/t/${code}`),
        };
        return htmlResponse(injectMeta(html, meta, { base: "/" }));
    });
