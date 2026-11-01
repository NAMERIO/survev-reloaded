/** @jsxImportSource react */
import type { MapId } from "@survev/shared/gameConfig.ts";
import { TeamMode } from "@survev/shared/gameConfig.ts";
import { CardFrame, PlayerSprite, SHADOW, SOFT, YELLOW } from "./cardFrame.tsx";
import { fitFontSize } from "./fit.ts";
import { teamModeLabel } from "./labels.ts";
import { mapArt } from "./maps.ts";

const SPRITE_SIZE = 56;

export async function teamCard(props: {
    code: string;
    players: string[];
    teamMode: TeamMode;
    region: string;
    mapId: MapId;
}) {
    const { code, players, teamMode, region, mapId } = props;
    const leader = players[0];
    const full = players.length >= teamMode;
    const mode = teamModeLabel(teamMode);
    const rowHeight = teamMode === TeamMode.Duo ? 96 : 76;
    const spriteTop = (rowHeight - SPRITE_SIZE) / 2;

    const sprites = await Promise.all(
        players.map((_, i) =>
            PlayerSprite({ x: 8, y: spriteTop, size: SPRITE_SIZE, outfit: i ? "outfitSpetsnaz" : "outfitBase" })
        ),
    );

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
                    {Array.from({ length: teamMode }, (_, i) => {
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
                                    ? sprites[i]
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
