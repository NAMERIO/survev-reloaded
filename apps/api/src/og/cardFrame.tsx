/** @jsxImportSource react */
import { OutfitDefs } from "@survev/shared/defs/gameObjects/outfitDefs.ts";
import type { ReactNode } from "react";
import { assetDataUrl, FONT_STACK } from "./render.ts";

type OutfitKey = keyof typeof OutfitDefs;

export const YELLOW = "#ffdb00";
export const DIM = "#9a9a9a";
export const SOFT = "#e2e2e2";
const INK = "#0b0b0b";
export const SHADOW = { textShadow: "0 2px 10px rgba(0,0,0,.95)" };

const SHARP_MASK = "linear-gradient(100deg, transparent 36%, rgba(0,0,0,.3) 50%, rgba(0,0,0,.75) 62%, black 74%)";

const inkAlpha = (alpha: number) => `rgba(11,11,11,${alpha})`;

function Wash({ background }: { background: string }) {
    return <div style={{ position: "absolute", inset: 0, backgroundImage: background }} />;
}

function Mark({ label }: { label: "stats" | "invite" }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 24, ...SHADOW }}>
            <span>SURVEV.IO</span>
            <div
                style={{ width: 3, height: 29, background: YELLOW, borderRadius: 2, transform: "rotate(15deg)" }}
            />
            <span style={{ color: YELLOW }}>{label}</span>
        </div>
    );
}

export interface FrameArt {
    splash: string;
    tint: string;
    position: string;
    filter?: string;
    name: string;
}

/** the Vivid side fade: sharp art on the right melts left into a blurred, saturated, map-tinted copy */
export async function CardFrame(props: {
    art: FrameArt;
    showMapName: boolean;
    label: "stats" | "invite";
    children: ReactNode;
}) {
    const { art, showMapName, label } = props;
    const src = await assetDataUrl(art.splash);
    const image = { position: "absolute", left: 0, top: 0, width: 1200, height: 630, objectFit: "cover" } as const;
    const tint = (alpha: number) => `rgba(${art.tint},${alpha})`;

    return (
        <div
            style={{
                position: "relative",
                display: "flex",
                width: "100%",
                height: "100%",
                overflow: "hidden",
                background: INK,
                fontFamily: FONT_STACK,
                color: "#fff",
            }}
        >
            <img
                src={src}
                style={{ ...image, objectPosition: art.position, filter: "blur(34px) brightness(.72) saturate(1.8)" }}
            />
            <img
                src={src}
                style={{
                    ...image,
                    objectPosition: art.position,
                    filter: art.filter,
                    maskImage: SHARP_MASK,
                    WebkitMaskImage: SHARP_MASK,
                }}
            />
            <Wash
                background={`linear-gradient(100deg, ${tint(0.62)} 0%, ${tint(0.55)} 34%, ${tint(0.2)} 52%, ${
                    tint(0)
                } 64%)`}
            />
            <Wash
                background={`radial-gradient(circle 280px at 1200px 630px, ${inkAlpha(0.75)} 20%, ${inkAlpha(0)} 100%)`}
            />
            {showMapName && (
                <div style={{ position: "absolute", right: 50, top: 44, display: "flex", fontSize: 42, ...SHADOW }}>
                    {art.name}
                </div>
            )}
            <div style={{ position: "absolute", right: 50, bottom: 44, display: "flex" }}>
                <Mark label={label} />
            </div>
            {props.children}
        </div>
    );
}

const OUTLINE = "#111";
const hexColor = (tint: number) => `#${tint.toString(16).padStart(6, "0")}`;

/** the game's unarmed pose in an outfit from its defs. Hand offsets come from the fists pose in animData.ts */
export async function PlayerSprite(props: { x: number; y: number; size: number; outfit: OutfitKey }) {
    const { x, y, size, outfit } = props;
    const { baseTint, baseSprite, handTint } = OutfitDefs[outfit].skinImg;
    const plainBody = outfit === "outfitBase";
    const skin = plainBody ? undefined : await assetDataUrl(`img/player/${baseSprite.slice(0, -4)}.svg`);
    const line = Math.max(3, size * 0.05);
    const hand = size * 0.34;
    const handStyle = (cx: number, cy: number) => ({
        position: "absolute" as const,
        left: cx - hand / 2,
        top: cy - hand / 2,
        width: hand,
        height: hand,
        borderRadius: hand / 2,
        background: hexColor(handTint),
        border: `${line}px solid ${OUTLINE}`,
    });
    return (
        <div
            style={{
                position: "absolute",
                left: x,
                top: y,
                width: size,
                height: size,
                transform: `rotate(${plainBody ? 60 : -60}deg)`,
            }}
        >
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: size / 2,
                    background: hexColor(baseTint),
                    border: `${line}px solid ${OUTLINE}`,
                    overflow: "hidden",
                }}
            >
                {skin && <img src={skin} style={{ width: "100%", height: "100%" }} />}
            </div>
            <div style={handStyle(size * 0.13, size * 0.1)} />
            <div style={handStyle(size * 0.87, size * 0.1)} />
        </div>
    );
}
