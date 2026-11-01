/** @jsxImportSource react */
import type { MapId } from "@survev/shared/gameConfig.ts";
import { TeamMode } from "@survev/shared/gameConfig.ts";
import { CardFrame, PlayerSprite, SHADOW, SOFT, YELLOW } from "./cardFrame.tsx";
import { fitFontSize } from "./fit.ts";
import { TEAM_MODE_LABELS } from "./leaderboardCard.tsx";
import { mapArt } from "./maps.ts";
import { assetDataUrl } from "./render.ts";

const SECOND_SKIN = "img/player/player-base-outfitSpetsnaz.svg";
const SPRITE_SIZE = 56;

export async function teamCard(props: {
    code: string;
    players: string[];
    maxPlayers: number;
    region: string;
    mapId: MapId;
}) {
    const { code, players, maxPlayers, region, mapId } = props;
    const leader = players[0];
    const full = players.length >= maxPlayers;
    const mode = TEAM_MODE_LABELS[maxPlayers === TeamMode.Duo ? TeamMode.Duo : TeamMode.Squad];
    const rowHeight = maxPlayers === TeamMode.Duo ? 96 : 76;
    const spriteTop = (rowHeight - SPRITE_SIZE) / 2;
    const skin = await assetDataUrl(SECOND_SKIN);

    return CardFrame({
        art: mapArt(mapId),
        showMapName: true,
        label: "invite",
        children: (
            <div
                style={{
                    position: "absolute",
                    left: 70,
                    top: 46,
                    bottom: 40,
                    width: 570,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                }}
            >
                <div style={{ display: "flex", flexDirection: "column", gap: 4, ...SHADOW }}>
                    <span
                        style={{ fontSize: fitFontSize(`${full ? "" : "JOIN "}${leader}`, 78, 560), lineHeight: 1.1 }}
                    >
                        {full ? "" : "JOIN "}
                        <span style={{ color: YELLOW }}>{leader}</span>
                    </span>
                    <span style={{ fontSize: 28, color: SOFT }}>
                        {mode} · {region.toUpperCase()}
                        {full ? " · FULL" : ""}
                    </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                    {Array.from({ length: maxPlayers }, (_, i) => {
                        const name = players[i];
                        const next = i === players.length;
                        const color = name ? "#fff" : next ? YELLOW : "rgba(255,255,255,.65)";
                        return (
                            <div
                                key={i}
                                style={{
                                    position: "relative",
                                    display: "flex",
                                    alignItems: "center",
                                    height: rowHeight,
                                    paddingLeft: 92,
                                    fontSize: name ? fitFontSize(name, 40, 450) : 38,
                                    color,
                                    borderTop: i ? "2px solid rgba(255,255,255,.16)" : "none",
                                    ...SHADOW,
                                }}
                            >
                                {name
                                    ? (
                                        <PlayerSprite
                                            x={8}
                                            y={spriteTop}
                                            size={SPRITE_SIZE}
                                            alt={i > 0}
                                            skin={i > 0 ? skin : undefined}
                                        />
                                    )
                                    : (
                                        <div
                                            style={{
                                                position: "absolute",
                                                left: 8,
                                                top: spriteTop,
                                                width: SPRITE_SIZE,
                                                height: SPRITE_SIZE,
                                                borderRadius: SPRITE_SIZE / 2,
                                                border: `4px dashed ${next ? YELLOW : "rgba(255,255,255,.45)"}`,
                                            }}
                                        />
                                    )}
                                {name ?? (next ? "YOU?" : "OPEN")}
                            </div>
                        );
                    })}
                </div>
                <span style={{ fontSize: 29, ...SHADOW }}>
                    survev.io/t/<span style={{ color: YELLOW }}>{code}</span>
                </span>
            </div>
        ),
    });
}
