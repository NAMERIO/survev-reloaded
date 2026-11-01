import { MapDefs } from "@survev/shared/defs/mapDefs.ts";
import { MapId } from "@survev/shared/gameConfig.ts";

/** the dark shade each map's fade melts into, and how its splash art is framed on the card */
interface MapStyle {
    splash: string;
    tint: string;
    position: string;
    filter?: string;
}

// maps without their own splash borrow one and keep their tint and name
const styles: Record<MapId, MapStyle> = {
    [MapId.Main]: { splash: "main", tint: "9,24,13", position: "70% 60%" },
    [MapId.Desert]: { splash: "desert", tint: "32,18,7", position: "80% 50%" },
    [MapId.Woods]: { splash: "main_spring", tint: "24,20,7", position: "70% 60%" },
    [MapId.Faction]: { splash: "faction", tint: "12,20,10", position: "50% 50%" },
    [MapId.Potato]: { splash: "potato_spring", tint: "9,24,13", position: "50% 50%" },
    [MapId.Savannah]: { splash: "main_spring", tint: "28,26,8", position: "70% 60%" },
    [MapId.Halloween]: {
        splash: "halloween",
        tint: "26,13,5",
        position: "50% 50%",
        filter: "brightness(1.9) saturate(1.2)",
    },
    [MapId.Cobalt]: { splash: "cobalt", tint: "9,17,32", position: "80% 50%" },
    [MapId.Birthday]: { splash: "main_spring", tint: "9,24,13", position: "70% 60%" },
    [MapId.Beach]: { splash: "main_spring", tint: "9,24,13", position: "70% 60%" },
    [MapId.FactionPotato]: { splash: "faction", tint: "12,20,10", position: "50% 50%" },
};

export function mapArt(mapId: MapId) {
    const style = styles[mapId];
    const def = Object.values(MapDefs).find((map) => map.mapId === mapId);
    return {
        ...style,
        splash: `img/splashes/${style.splash}.webp`,
        name: (def?.desc.name || "").toUpperCase(),
    };
}
