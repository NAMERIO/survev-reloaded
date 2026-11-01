export interface PageMeta {
    title: string;
    description: string;
    image: string;
    url: string;
}

function escapeHtml(text: string) {
    return text
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;");
}

const OLD_TAGS = /<meta\b[^>]*\b(?:property|name)="(?:og|twitter):[^"]*"[^>]*>\s*/g;
const OLD_TITLE = /<title>[\s\S]*?<\/title>\s*/;

/** swaps the page's preview tags for this link's. `base` is for pages served away from their usual path */
export function injectMeta(html: string, meta: PageMeta, options: { base?: string } = {}) {
    const [title, description, image, url] = [meta.title, meta.description, meta.image, meta.url].map(escapeHtml);
    const tags = [
        options.base ? `<base href="${escapeHtml(options.base)}">` : "",
        `<title>${title}</title>`,
        `<meta property="og:type" content="website">`,
        `<meta property="og:site_name" content="survev.io">`,
        `<meta property="og:title" content="${title}">`,
        `<meta property="og:description" content="${description}">`,
        `<meta property="og:url" content="${url}">`,
        `<meta property="og:image" content="${image}">`,
        `<meta property="og:image:width" content="1200">`,
        `<meta property="og:image:height" content="630">`,
        `<meta name="twitter:card" content="summary_large_image">`,
        `<meta name="twitter:title" content="${title}">`,
        `<meta name="twitter:description" content="${description}">`,
        `<meta name="twitter:image" content="${image}">`,
    ].filter(Boolean).join("\n");
    const cleaned = html.replace(OLD_TAGS, "").replace(OLD_TITLE, "");
    // base has to come before anything with a relative url
    if (options.base) return cleaned.replace(/<head>/, `<head>\n${tags}`);
    return cleaned.replace("</head>", `${tags}\n</head>`);
}
