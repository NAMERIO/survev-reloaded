import { MapId, TeamMode } from "@survev/shared/gameConfig.ts";
import { ALL_MAPS } from "@survev/shared/types/stats.ts";
import { expect, test } from "bun:test";
import { parseLeaderboardParams, parsePlayerParams } from "../../src/og/params.ts";

test("bad filters fall back to page defaults", () => {
    expect(parseLeaderboardParams(new URLSearchParams("type=nope&team=x&t=y&mapId=999")))
        .toEqual({ type: "most_kills", teamMode: TeamMode.Solo, interval: "daily", mapId: MapId.Main });
    expect(parsePlayerParams(new URLSearchParams("time=x&mapId=y"))).toEqual({
        interval: "alltime",
        mapIdFilter: ALL_MAPS,
    });
});

test("uses the page's param names", () => {
    expect(parseLeaderboardParams(new URLSearchParams("type=wins&team=squad&t=alltime&mapId=6")))
        .toEqual({ type: "wins", teamMode: TeamMode.Squad, interval: "alltime", mapId: MapId.Halloween });
    expect(parsePlayerParams(new URLSearchParams("time=weekly&mapId=1"))).toEqual({
        interval: "weekly",
        mapIdFilter: "1",
    });
});
