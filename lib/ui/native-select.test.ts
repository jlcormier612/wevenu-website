import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { HTC_NATIVE_SELECT_CLASS } from "@/lib/ui/native-select";

const ROOT = join(__dirname, "../..");

const PORTAL_SELECT_SURFACES = [
  "components/portal/portal-shell.tsx",
  "components/portal/guest-section.tsx",
  "components/portal/seating-section.tsx",
  "components/portal/timeline-section.tsx",
  "components/portal/website-editor.tsx",
  "components/vendor-app/vendor-venue-hero.tsx",
] as const;

describe("htc-native-select discoverability", () => {
  it("exports the shared class used by CSS", () => {
    assert.equal(HTC_NATIVE_SELECT_CLASS, "htc-native-select");
    const css = readFileSync(join(ROOT, "app/globals.css"), "utf8");
    assert.match(css, /\.htc-native-select\s*\{/);
    assert.match(css, /appearance:\s*none/);
    assert.match(css, /background-image:/);
  });

  it("wires the class onto every client-portal / vendor native select surface", () => {
    for (const rel of PORTAL_SELECT_SURFACES) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      assert.match(src, /HTC_NATIVE_SELECT_CLASS/, `${rel} must import/use HTC_NATIVE_SELECT_CLASS`);
      const selectCount = (src.match(/<select\b/g) ?? []).length;
      const classCount = (src.match(/HTC_NATIVE_SELECT_CLASS/g) ?? []).length;
      // import + one use per <select>
      assert.ok(classCount >= selectCount + 1, `${rel}: ${selectCount} selects need the class (${classCount} refs)`);
    }
  });

  it("marks Support Access duration for browser acceptance", () => {
    const shell = readFileSync(join(ROOT, "components/portal/portal-shell.tsx"), "utf8");
    assert.match(shell, /id="support-access-duration"/);
    assert.match(shell, /data-testid="support-access-duration"/);
    assert.match(shell, /HTC_NATIVE_SELECT_CLASS/);
  });
});
