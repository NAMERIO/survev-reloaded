import { expect, test } from "bun:test";
import { teamCodeFromPath } from "../src/teamLink.ts";

test("reads a code from /t/ paths only", () => {
    expect(teamCodeFromPath("/t/qk4z")).toBe("qk4z");
    expect(teamCodeFromPath("/t/qk4z/")).toBe("qk4z");
    expect(teamCodeFromPath("/")).toBeNull();
    expect(teamCodeFromPath("/stats/")).toBeNull();
});
