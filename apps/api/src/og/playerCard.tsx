/** @jsxImportSource react */
import { EmotesDefs } from "@survev/shared/defs/gameObjects/emoteDefs.ts";
import { MapId } from "@survev/shared/gameConfig.ts";
import type { UserStatsRequest, UserStatsResponse } from "@survev/shared/types/stats.ts";
import { CardFrame, SOFT, YELLOW } from "./cardFrame.tsx";
import { fitFontSize } from "./fit.ts";
import { mapArt } from "./maps.ts";
import { assetDataUrl } from "./render.ts";

export const INTERVAL_LABELS: Record<UserStatsRequest["interval"], string> = {
    daily: "TODAY",
    weekly: "THIS WEEK",
    alltime: "ALL TIME",
};

function avatarPath(playerIcon: string) {
    const texture = EmotesDefs[playerIcon]?.texture;
    return texture ? `img/emotes/${texture.slice(0, -4)}.svg` : "img/gui/player-gui.svg";
}

function Stat(props: { value: string; label: string; size: number; color?: string }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: props.size, lineHeight: 1, color: props.color ?? "#fff" }}>{props.value}</span>
            <span style={{ fontSize: 24, color: "#bdbdbd", letterSpacing: 2 }}>{props.label}</span>
        </div>
    );
}

export async function playerCard(props: {
    stats: UserStatsResponse;
    interval: UserStatsRequest["interval"];
    mapId: MapId | null;
}) {
    const { stats, interval, mapId } = props;
    const avatar = await assetDataUrl(avatarPath(stats.player_icon));
    const name = stats.username;
    return (
        await CardFrame({
            art: mapArt(mapId ?? MapId.Main),
            showMapName: mapId !== null,
            label: "stats",
            children: (
                <div
                    style={{
                        position: "absolute",
                        left: 70,
                        top: 50,
                        bottom: 46,
                        width: 600,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                        <img src={avatar} style={{ width: 96, height: 96 }} />
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <span style={{ fontSize: fitFontSize(name, 72, 480), lineHeight: 1.1 }}>{name}</span>
                            <span style={{ fontSize: 26, color: SOFT }}>{INTERVAL_LABELS[interval]}</span>
                        </div>
                    </div>
                    <Stat value={stats.kills.toLocaleString("en-US")} label="KILLS" size={150} color={YELLOW} />
                    <div style={{ display: "flex", gap: 70 }}>
                        <Stat value={stats.wins.toLocaleString("en-US")} label="WINS" size={64} />
                        <Stat value={stats.kpg} label="KPG" size={64} />
                        <Stat value={stats.games.toLocaleString("en-US")} label="GAMES" size={64} />
                    </div>
                </div>
            ),
        })
    );
}
