import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("unused Weven setup-migration wizard is gone", () => {
  it("no longer ships Weven source cards or the unused BringYourBusinessStep wizard", () => {
    assert.equal(existsSync(resolve("components/setup/setup-migration-steps.tsx")), false);
    const steps = readFileSync(resolve("components/setup/setup-steps.tsx"), "utf8");
    assert.match(steps, /function useSetupReadyCounts/);
    assert.match(steps, /getSetupReadyCountsAction/);
    assert.doesNotMatch(steps, /from "@\/components\/setup\/setup-migration-steps"/);
    assert.doesNotMatch(steps, /Weven/);
  });
});
