import { Renderer } from "@takumi-rs/core";
import path from "node:path";
import type { ReactElement } from "react";
import { render } from "takumi-js";
import { env } from "../env.ts";

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

/** the fallbacks cover names the game font can't draw; takumi never reads system fonts */
const fallbackFonts = {
    "Noto Sans": "NotoSans-Bold.ttf",
    "Noto Sans JP": "NotoSansJP-Bold.otf",
    "Noto Sans KR": "NotoSansKR-Bold.otf",
    "Noto Sans SC": "NotoSansSC-Bold.otf",
    "Noto Sans Thai": "NotoSansThai-Bold.ttf",
    "Noto Sans Arabic": "NotoSansArabic-Bold.ttf",
};

const GAME_FONT = "Phantom Guardians";
export const FONT_STACK = [GAME_FONT, ...Object.keys(fallbackFonts)].map((name) => `"${name}"`).join(", ");

// dist/fonts next to the bundle, assets/fonts when running from source
const fontDirs = [path.join(import.meta.dir, "fonts"), path.join(import.meta.dir, "../../assets/fonts")];

async function fontFile(name: string) {
    for (const dir of fontDirs) {
        const file = Bun.file(path.join(dir, name));
        if (await file.exists()) return file.bytes();
    }
    throw new Error(`missing font ${name}`);
}

let rendererPromise: Promise<Renderer> | undefined;

function getRenderer() {
    rendererPromise ??= (async () => {
        const renderer = new Renderer();
        await renderer.registerFont({ name: GAME_FONT, data: await webAsset("fonts/phantom-guardians-bold.otf") });
        for (const [name, file] of Object.entries(fallbackFonts)) {
            await renderer.registerFont({ name, data: await fontFile(file) });
        }
        return renderer;
    })();
    return rendererPromise;
}

export async function renderCard(element: ReactElement): Promise<Uint8Array> {
    return render(element, { width: CARD_WIDTH, height: CARD_HEIGHT, renderer: await getRenderer() });
}

const assets = new Map<string, Uint8Array>();

/** a file from the client's public files. Paths come from our own tables, never from a request */
export async function webAsset(relativePath: string): Promise<Uint8Array> {
    if (relativePath.includes("..")) throw new Error(`bad asset path ${relativePath}`);
    let bytes = assets.get(relativePath);
    if (!bytes) {
        bytes = await Bun.file(path.join(env.WEB_ROOT, relativePath)).bytes();
        assets.set(relativePath, bytes);
    }
    return bytes;
}

const MIME = { svg: "image/svg+xml", webp: "image/webp" };

export async function assetDataUrl(relativePath: string) {
    const mime = relativePath.endsWith(".svg") ? MIME.svg : MIME.webp;
    return `data:${mime};base64,${Buffer.from(await webAsset(relativePath)).toString("base64")}`;
}
