import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

describe("Program 3 ingest notify bridge", () => {
  it("bridge notifies Program 3 after contact and Calendly sync", () => {
    const bridgePath = fileURLToPath(new URL("./bridge.ts", import.meta.url));
    const src = readFileSync(bridgePath, "utf8");
    assert.match(src, /notifyProgram3IngestEvent/);
    assert.match(src, /status_enter/);
    assert.match(src, /walkthrough_canceled/);
  });

  it("seed workflows and sequences stay inactive by default", () => {
    const seedPath = fileURLToPath(
      new URL(
        "../../../workspace/lib/program3/seed.ts",
        import.meta.url,
      ),
    );
    const src = readFileSync(seedPath, "utf8");
    assert.doesNotMatch(src, /active:\s*true/);
    assert.match(src, /active:\s*false/);
  });
});
