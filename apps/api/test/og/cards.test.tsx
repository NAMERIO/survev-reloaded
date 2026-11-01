/** @jsxImportSource react */
import { MapId, TeamMode } from "@survev/shared/gameConfig.ts";
import type { LeaderboardResponse, UserStatsResponse } from "@survev/shared/types/stats.ts";
import { describe, expect, test } from "bun:test";
import { env } from "../../src/env.ts";
import { fitFontSize } from "../../src/og/fit.ts";
import { genericCard } from "../../src/og/genericCard.tsx";
import { leaderboardCard } from "../../src/og/leaderboardCard.tsx";
import { mapArt } from "../../src/og/maps.ts";
import { playerCard } from "../../src/og/playerCard.tsx";
import { renderCard } from "../../src/og/render.ts";
import { teamCard } from "../../src/og/teamCard.tsx";

const WIDE = "WWWWWWWWWWWWWWWW";
const stats = (username: string): UserStatsResponse => ({
    slug: "x",
    username,
    player_icon: "",
    banned: false,
    wins: 1126,
    kills: 18204,
    games: 3866,
    kpg: "4.71",
    modes: [],
});
const row = (username: string, val = 62): LeaderboardResponse => ({ val, region: "na", slug: "x", username });
const team = { code: "qk4z", region: "na", mapId: MapId.Desert };
const params = { type: "most_kills", teamMode: TeamMode.Solo, interval: "daily", mapId: MapId.Main } as const;

test("every map has art and a name", async () => {
    for (const id of Object.values(MapId)) {
        if (typeof id !== "number") continue;
        const art = mapArt(id);
        expect(art.name).not.toBe("");
        expect(await Bun.file(`${env.WEB_ROOT}/${art.splash}`).exists()).toBe(true);
    }
});

test("fitFontSize keeps the worst name inside its budget", () => {
    expect(fitFontSize(WIDE, 52, 390) * 16 * 0.82).toBeLessThanOrEqual(390);
    expect(fitFontSize("Vektor", 52, 390)).toBe(52);
});

test("renders a 1200x630 png", async () => {
    const png = await renderCard(await genericCard({ title: "A", subtitle: "B", label: "stats" }));
    expect(Array.from(png.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
    const view = new DataView(png.buffer, png.byteOffset);
    expect([view.getUint32(16), view.getUint32(20)]).toEqual([1200, 630]);
});

test.each(["影の狙撃手", "Вектор", "그림자", "ผู้เล่น"])("%s draws real glyphs", async (name) => {
    const style = { fontSize: 80, fontFamily: `"Noto Sans", "Noto Sans JP", "Noto Sans KR", "Noto Sans Thai"` };
    const real = await renderCard(<div style={style}>{name}</div>);
    const missing = await renderCard(<div style={style}>{"".repeat([...name].length)}</div>);
    expect(Buffer.compare(real, missing)).not.toBe(0);
});

describe("cards render", () => {
    const cases: [string, () => ReturnType<typeof genericCard>][] = [
        ["player", () => playerCard({ stats: stats("Vektor"), interval: "alltime", mapId: null })],
        ["player long", () => playerCard({ stats: stats(WIDE), interval: "weekly", mapId: MapId.Halloween })],
        ["leaderboard", () => leaderboardCard({ rows: [row("Vektor"), row("影の狙撃手", 58)], params })],
        [
            "squad leaderboard",
            () =>
                leaderboardCard({
                    rows: [{ val: 9, region: "na", slugs: [null], usernames: [WIDE, WIDE, "kiwi", "Moss"] }],
                    params: { ...params, teamMode: TeamMode.Squad },
                }),
        ],
        ["team 1/4", () => teamCard({ ...team, players: ["Vektor"], maxPlayers: 4 })],
        ["team 1/2", () => teamCard({ ...team, players: ["Vektor"], maxPlayers: 2 })],
        ["team full", () => teamCard({ ...team, players: ["Vektor", "nomad_"], maxPlayers: 2 })],
        ["team long", () => teamCard({ ...team, players: [WIDE, "MMMMMMMMMMMMMMMM", "影の狙撃手"], maxPlayers: 4 })],
    ];
    test.each(cases)("%s", async (_, card) => {
        expect((await renderCard(await card())).byteLength).toBeGreaterThan(5000);
    });
});
