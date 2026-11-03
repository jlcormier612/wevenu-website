import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  contiguousSetupStageRuns,
  SETUP_STAGE_SECTION_HEADING,
  setupStageSectionBucket,
} from "@/lib/setup-hub/stage-section-runs";

describe("Setup Hub stage section runs — Phase 9 Option A", () => {
  it("maps only status===complete to the complete bucket", () => {
    assert.equal(setupStageSectionBucket("complete"), "complete");
    assert.equal(setupStageSectionBucket("not_started"), "incomplete");
    assert.equal(setupStageSectionBucket("in_progress"), "incomplete");
    assert.equal(setupStageSectionBucket(null), "incomplete");
  });

  it("reuses readiness heading copy and never invents ready_to_invite wording", () => {
    assert.equal(SETUP_STAGE_SECTION_HEADING.complete, "All set");
    assert.equal(SETUP_STAGE_SECTION_HEADING.incomplete, "Still needs your attention");
  });

  it("preserves stage order across contiguous runs (partial)", () => {
    const stages = [
      { key: "a", status: "complete" as const },
      { key: "b", status: "complete" as const },
      { key: "c", status: "complete" as const },
      { key: "d", status: "not_started" as const },
      { key: "e", status: null },
      { key: "f", status: "complete" as const },
    ];
    const runs = contiguousSetupStageRuns(stages);
    assert.equal(runs.length, 3);
    assert.deepEqual(
      runs.map((r) => ({ heading: r.heading, keys: r.stages.map((s) => s.key) })),
      [
        { heading: "All set", keys: ["a", "b", "c"] },
        { heading: "Still needs your attention", keys: ["d", "e"] },
        { heading: "All set", keys: ["f"] },
      ],
    );
    assert.deepEqual(
      runs.flatMap((r) => r.stages.map((s) => s.key)),
      stages.map((s) => s.key),
    );
  });

  it("uses a single incomplete heading when nothing is complete", () => {
    const runs = contiguousSetupStageRuns([
      { key: "a", status: null },
      { key: "b", status: "not_started" as const },
    ]);
    assert.equal(runs.length, 1);
    assert.equal(runs[0].heading, "Still needs your attention");
  });

  it("uses a single All set heading when every stage is complete", () => {
    const runs = contiguousSetupStageRuns([
      { key: "a", status: "complete" as const },
      { key: "b", status: "complete" as const },
    ]);
    assert.equal(runs.length, 1);
    assert.equal(runs[0].heading, "All set");
  });
});

describe("Phase 9 Setup Hub + Settings structural seams", () => {
  const read = (rel: string) => readFileSync(resolve(rel), "utf8");
  const overview = read("components/setup-hub/setup-hub-overview.tsx");
  const settings = read("app/(app)/settings/page.tsx");
  const setupPage = read("app/(app)/setup-hub/page.tsx");
  const css = read("app/globals.css");

  it("Setup Hub overview uses contiguous runs + eucalyptus section label without hospitality intro", () => {
    assert.match(overview, /contiguousSetupStageRuns/);
    assert.match(overview, /htc-setup-stage-section-label/);
    assert.match(overview, /data-htc-phase9="setup-stages"/);
    assert.doesNotMatch(overview, /htc-hospitality-intro/);
    assert.match(overview, /SetupConciergeCard/);
    // Stage keys remain in the same authored order (sample anchors).
    const venue = overview.indexOf('"your-venue"');
    const calendar = overview.indexOf('"calendar-availability"');
    const byb = overview.indexOf('"bring-your-business"');
    const offerings = overview.indexOf('"your-offerings"');
    const client = overview.indexOf('"client-experience"');
    const lead = overview.indexOf('"lead-capture"');
    const team = overview.indexOf('"your-team"');
    const financials = overview.indexOf('key: "financials"');
    assert.ok(venue < calendar && calendar < byb && byb < offerings);
    assert.ok(offerings < client && client < lead && lead < team && team < financials);
  });

  it("Phase 4 white-glove welcome gate and calm class remain on Setup Hub page", () => {
    assert.match(setupPage, /htc-setup-hub-welcome/);
    assert.match(setupPage, /onboardingType === "white_glove"/);
    assert.match(setupPage, /Welcome to Hello to Cheers/);
  });

  it("Settings directory keeps six tiles, white cards, and eucalyptus icon wells", () => {
    assert.match(settings, /data-htc-phase9="settings-directory"/);
    assert.match(settings, /htc-settings-directory-icon/);
    assert.match(settings, /bg-card p-5/);
    assert.doesNotMatch(settings, /htc-hospitality-intro|htc-settings-linen|p9b-settings-linen/);
    const hrefs = [
      "/settings/business",
      "/settings/leads",
      "/settings/availability",
      "/settings/communications",
      "/settings/integrations",
      "/settings/team",
    ];
    for (const href of hrefs) assert.match(settings, new RegExp(`href:\\s*"${href}"`));
    assert.equal((settings.match(/href:\s*"\/settings\//g) ?? []).length, 6);
  });

  it("Phase 9 CSS scopes eucalyptus surfaces without recoloring welcome", () => {
    assert.match(css, /\.htc-staff \.htc-setup-stage-section-label/);
    assert.match(
      css,
      /\.htc-staff \.htc-setup-stage-section-label \{[\s\S]*?background:\s*var\(--htc-eucalyptus-surface\)/,
    );
    assert.match(css, /\.htc-staff \.htc-settings-directory-icon/);
    assert.match(
      css,
      /\.htc-staff \.htc-settings-directory-icon \{[\s\S]*?background:\s*var\(--htc-eucalyptus-surface\)/,
    );
    assert.match(css, /\.htc-staff \.htc-setup-hub-welcome/);
    assert.match(css, /background-color:\s*var\(--htc-calm-blue\)/);
  });
});
