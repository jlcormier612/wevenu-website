/**
 * Color Distribution Phase 9 — Setup Hub Option A + Settings Option B.
 * Structural / token seams only; completion and readiness logic unchanged.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const read = (rel: string) => readFileSync(resolve(rel), "utf8");

describe("Color Distribution Phase 9 — Setup Hub + Settings directory", () => {
  const css = read("app/globals.css");
  const overview = read("components/setup-hub/setup-hub-overview.tsx");
  const setupPage = read("app/(app)/setup-hub/page.tsx");
  const settings = read("app/(app)/settings/page.tsx");
  const business = read("app/(app)/settings/business/page.tsx");
  const availability = read("app/(app)/settings/availability/page.tsx");

  it("defines scoped eucalyptus Setup stage label and Settings icon well", () => {
    assert.match(css, /\.htc-staff \.htc-setup-stage-section-label \{[\s\S]*?background:\s*var\(--htc-eucalyptus-surface\)/);
    assert.match(css, /\.htc-staff \.htc-settings-directory-icon \{[\s\S]*?background:\s*var\(--htc-eucalyptus-surface\)/);
    assert.match(css, /--htc-eucalyptus-surface:\s*#dce8e0/i);
  });

  it("Setup Hub uses Option A section labels without Phase 8 eucalyptus intro fill", () => {
    assert.match(overview, /contiguousSetupStageRuns\(stages\)/);
    assert.match(overview, /htc-setup-stage-section-label/);
    assert.doesNotMatch(overview, /htc-hospitality-intro[^-]|htc-linen-group|p9b-/);
    assert.match(setupPage, /htc-setup-hub-welcome/);
    assert.match(setupPage, /htc-hospitality-heading htc-hospitality-intro-accent/);
    assert.doesNotMatch(setupPage, /className="htc-hospitality-intro"/);
  });

  it("Settings directory uses blush tiles with record-link titles; details untouched by Phase 9 classes", () => {
    assert.match(settings, /htc-settings-directory-icon/);
    assert.match(settings, /htc-settings-directory-card/);
    assert.match(settings, /htc-record-link text-sm font-medium/);
    assert.equal((settings.match(/href:\s*"\/settings\//g) ?? []).length, 6);
    assert.match(settings, /htc-hospitality-heading htc-hospitality-intro-accent/);
    assert.doesNotMatch(settings, /className="htc-hospitality-intro"/);
    assert.doesNotMatch(settings, /F3F0E9/);
    assert.doesNotMatch(settings, /htc-linen/);
    assert.doesNotMatch(business, /htc-settings-directory-icon|htc-setup-stage-section-label/);
    assert.match(availability, /htc-availability-settings-guidance/);
    assert.doesNotMatch(availability, /htc-settings-directory-icon/);
    assert.match(css, /\.htc-settings-directory-card[\s\S]*--htc-soft-blush/);
  });
});
