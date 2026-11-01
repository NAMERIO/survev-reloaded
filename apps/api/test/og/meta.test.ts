import { describe, expect, test } from "bun:test";
import { injectMeta } from "../../src/og/meta.ts";

const PAGE = `<html><head>
<title>survev.io</title>
<meta
    property="og:description"
    content="old">
<meta content="https://old/x.png" property="og:image">
<link href="css/app.css" rel="stylesheet">
</head><body></body></html>`;
const META = { title: "t", description: "d", image: "https://x/i.png", url: "https://x/u" };

describe("injectMeta", () => {
    test("escapes hostile names", () => {
        const html = injectMeta(PAGE, { ...META, title: `"><script>x</script>` });
        expect(html).not.toContain("<script>x");
        expect(html).toContain("&quot;&gt;&lt;script&gt;");
    });
    test("replaces existing tags in either attribute order", () => {
        const html = injectMeta(PAGE, META);
        expect(html.match(/og:image"/g)).toHaveLength(1);
        expect(html).not.toContain("old");
        expect(html.match(/<title>/g)).toHaveLength(1);
        expect(html).toContain(`name="twitter:card" content="summary_large_image"`);
    });
    test("base comes before relative urls", () => {
        const html = injectMeta(PAGE, META, { base: "/" });
        expect(html.indexOf(`<base href="/">`)).toBeLessThan(html.indexOf("css/app.css"));
    });
});
