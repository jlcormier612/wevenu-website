import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

describe("Website Studio wizard scrollport contract", () => {
  const src = readFileSync(
    join(process.cwd(), "components/portal/website-studio.tsx"),
    "utf8",
  );

  it("WizardShell constrains the flex child so overflow-y-auto can scroll", () => {
    assert.match(src, /function WizardShell/);
    assert.match(src, /flex-1 min-h-0 overflow-y-auto/);
    assert.match(src, /fixed inset-0 z-50 flex flex-col bg-background overflow-hidden/);
  });

  it("wizard step bodies scroll via WizardShell instead of unscrollable flex centering", () => {
    assert.match(src, /function WizardShell/);
    assert.match(src, /Choose your favorite photo/);
    assert.match(src, /Create your Color Story/);
    // Photo / Color steps must use WizardShell (real scrollport).
    assert.match(
      src,
      /<WizardShell[\s\S]{0,500}?heading="Choose your favorite photo"/,
    );
    assert.match(
      src,
      /<WizardShell[\s\S]{0,800}?heading="Create your Color Story"/,
    );
  });

  it("exposes delete for engagement photos in the wizard photo step", () => {
    assert.match(src, /handlePhotoDelete/);
    assert.match(src, /aria-label="Delete photo"/);
    assert.match(src, /DELETE/);
  });
});
