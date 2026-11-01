/** @jsxImportSource react */
import { MapId } from "@survev/shared/gameConfig.ts";
import { CardFrame, SOFT, YELLOW } from "./cardFrame.tsx";
import { mapArt } from "./maps.ts";

/** for a missing player, an empty leaderboard or a dead room: crawlers cache failures, so never an error */
export function genericCard(props: { title: string; subtitle: string; label: "stats" | "invite" }) {
    return CardFrame({
        art: mapArt(MapId.Main),
        showMapName: false,
        label: props.label,
        children: (
            <div
                style={{
                    position: "absolute",
                    left: 70,
                    top: 0,
                    bottom: 0,
                    width: 600,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: 12,
                }}
            >
                <span style={{ fontSize: 84, lineHeight: 1.1, color: YELLOW }}>{props.title}</span>
                <span style={{ fontSize: 32, color: SOFT }}>{props.subtitle}</span>
            </div>
        ),
    });
}
