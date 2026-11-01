export interface PageMeta {
    title: string;
    description: string;
    image: string;
    url: string;
}

const isPreviewTag = (name: string | null) => name?.startsWith("og:") || name?.startsWith("twitter:");

/** swaps the page's preview tags for this link's. `base` is for pages served away from their usual path */
export function injectMeta(html: string, meta: PageMeta, options: { base?: string } = {}) {
    const { title, description, image, url } = meta;
    const tags = [
        ["property", "og:type", "website"],
        ["property", "og:site_name", "survev.io"],
        ["property", "og:title", title],
        ["property", "og:description", description],
        ["property", "og:url", url],
        ["property", "og:image", image],
        ["property", "og:image:width", "1200"],
        ["property", "og:image:height", "630"],
        ["name", "twitter:card", "summary_large_image"],
        ["name", "twitter:title", title],
        ["name", "twitter:description", description],
        ["name", "twitter:image", image],
    ].map(([attr, name, content]) => `<meta ${attr}="${name}" content="${Bun.escapeHTML(content)}">`);

    const head = [
        // base has to come before anything with a relative url
        options.base ? `<base href="${Bun.escapeHTML(options.base)}">` : "",
        `<title>${Bun.escapeHTML(title)}</title>`,
        ...tags,
    ].join("\n");

    return new HTMLRewriter()
        .on("title", { element: (el) => void el.remove() })
        .on("meta", {
            element(el) {
                if (isPreviewTag(el.getAttribute("property") ?? el.getAttribute("name"))) el.remove();
            },
        })
        .on("head", { element: (el) => void el.prepend(head, { html: true }) })
        .transform(html);
}
