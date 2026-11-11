/**
 * Preferred badge dark-mode contrast on the venue vendor list.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const list = readFileSync(resolve("components/vendors/vendor-list.tsx"), "utf8");

describe("vendor Preferred badge contrast", () => {
  it("keeps light-mode sage text and switches to foreground in dark mode", () => {
    const preferred = list.slice(
      list.indexOf('preferenceBadge === "preferred"'),
      list.indexOf('preferenceBadge === "recommended"'),
    );
    assert.match(preferred, /text-\[#3D5040\]/);
    assert.match(preferred, /dark:text-foreground/);
    assert.match(preferred, /dark:border-border/);
    assert.match(preferred, /data-testid="vendor-preference-preferred"/);
  });

  it("does not restyle the Required badge", () => {
    const required = list.slice(list.indexOf("vendor.isRequired"), list.indexOf("vendor.isInHouse"));
    assert.match(required, /bg-foreground text-background/);
    assert.doesNotMatch(required, /dark:text-foreground/);
  });
});
