import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

const LOAD = resolve(import.meta.dirname, "load.ts");

describe("Luv briefing operational isolation", () => {
  it("routes daily briefing through toOperationalWorkspaceData", () => {
    const src = readFileSync(LOAD, "utf8");
    assert.match(src, /toOperationalWorkspaceData/);
    assert.match(
      src,
      /loadLuvBriefing[\s\S]*toOperationalWorkspaceData\(getData\(\)\)/,
    );
  });
});
