import { expect, mock, test } from "bun:test";

const ip = await import("../../src/lib/ip.ts");
mock.module("../../src/lib/ip.ts", () => ({ ...ip, getIp: () => "1.2.3.4" }));
const { OgRoutes } = await import("../../src/og/routes.ts");

const get = (path: string) => OgRoutes.handle(new Request(`http://localhost${path}`));

test("a dead team code is a generic png, not an error", async () => {
    const res = await get("/api/og/team/nope");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
});

test("/t/ without a built page falls back to the hash link", async () => {
    const res = await get("/t/abcd");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/#abcd");
});

test("/t/ rejects anything outside the team code alphabet", async () => {
    const res = await get("/t/%3Cx%3E");
    expect(res.headers.get("location")).toBe("/");
});
