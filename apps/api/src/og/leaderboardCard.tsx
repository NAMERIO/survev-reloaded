/** @jsxImportSource react */
import type { LeaderboardRequest, LeaderboardResponse } from "@survev/shared/types/stats.ts";
import { CardFrame, DIM, SOFT, YELLOW } from "./cardFrame.tsx";
import { fitFontSize } from "./fit.ts";
import { intervalLabel, leaderboardTitle, teamModeLabel } from "./labels.ts";
import { mapArt } from "./maps.ts";

export function rowName(row: LeaderboardResponse) {
    return "usernames" in row ? row.usernames.join(" + ") : row.username;
}

function rowValue(row: LeaderboardResponse, type: LeaderboardRequest["type"]) {
    return type === "kpg" ? Number(row.val).toFixed(2) : Number(row.val).toLocaleString("en-US");
}

export function leaderboardCard(props: { rows: LeaderboardResponse[]; params: LeaderboardRequest }) {
    const { rows, params } = props;
    const title = leaderboardTitle(params.type);
    return CardFrame({
        art: mapArt(params.mapId),
        showMapName: true,
        label: "stats",
        children: (
            <div
                style={{
                    position: "absolute",
                    left: 70,
                    top: 46,
                    bottom: 44,
                    width: 560,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                }}
            >
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: fitFontSize(title, 60, 560), lineHeight: 1.05, color: YELLOW }}>
                        {title}
                    </span>
                    <span style={{ fontSize: 28, color: SOFT }}>
                        {teamModeLabel(params.teamMode)} · {intervalLabel(params.interval)}
                    </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                    {rows.slice(0, 5).map((row, i) => {
                        const name = rowName(row);
                        const size = i ? 36 : 52;
                        return (
                            <div
                                key={i}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    height: i ? 64 : 88,
                                    fontSize: size,
                                    color: i ? "#fff" : YELLOW,
                                    borderTop: i > 1 ? "2px solid rgba(255,255,255,.14)" : "none",
                                }}
                            >
                                <span style={{ width: 52, color: i ? DIM : YELLOW }}>{i + 1}</span>
                                <span style={{ display: "flex", flexGrow: 1, fontSize: fitFontSize(name, size, 400) }}>
                                    {name}
                                </span>
                                <span>{rowValue(row, params.type)}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        ),
    });
}
