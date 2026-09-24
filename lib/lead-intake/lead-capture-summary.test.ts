import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildLeadCaptureSourceBreakdown } from "@/lib/lead-intake/monitoring";

describe("Lead Capture venue summary", () => {
  it("collapses unknown/other into a single Other row and sorts by count", () => {
    const rows = buildLeadCaptureSourceBreakdown([
      { source: "website", count: 18 },
      { source: "google", count: 6 },
      { source: "other", count: 2 },
      { source: "unknown", count: 3 },
      { source: "instagram", count: 3 },
    ]);
    assert.equal(rows[0]?.label, "Website");
    assert.equal(rows[0]?.count, 18);
    assert.equal(rows.find((r) => r.label === "Other")?.count, 5);
    assert.equal(rows.filter((r) => r.label === "Other").length, 1);
  });

  it("customer UI does not mention Rejected, Errors, Confidence, or Intake Health", () => {
    const health = readFileSync(
      resolve("components/settings/lead-intake-health-section.tsx"),
      "utf8",
    );
    const email = readFileSync(
      resolve("components/settings/email-intake-section.tsx"),
      "utf8",
    );
    const settings = readFileSync(
      resolve("app/(app)/settings/leads/page.tsx"),
      "utf8",
    );
    const setupPage = readFileSync(
      resolve("app/(app)/setup-hub/lead-capture/page.tsx"),
      "utf8",
    );
    const setupStage = readFileSync(
      resolve("components/setup-hub/lead-capture-stage.tsx"),
      "utf8",
    );
    for (const blob of [health, email, settings]) {
      assert.doesNotMatch(blob, /Lead Intake Health/);
      assert.doesNotMatch(blob, /\bRejected\b/);
      assert.doesNotMatch(blob, /\bErrors\b/);
    }
    for (const blob of [email, settings]) {
      assert.doesNotMatch(blob, /Confidence/);
      assert.doesNotMatch(blob, /Last email/);
      assert.doesNotMatch(blob, /Last lead/);
    }
    // Reporting/activity stays in the shared component but is not mounted on setup surfaces.
    assert.match(health, /inquiries received in the last 7 days/);
    assert.match(health, /Where your inquiries come from/);
    assert.match(health, /All caught up/);
    assert.doesNotMatch(settings, /LeadIntakeHealthSection/);
    assert.doesNotMatch(setupPage, /getIntakeHealthSummary|LeadIntakeHealthSection|intakeHealth/);
    assert.doesNotMatch(setupStage, /LeadIntakeHealthSection|intakeHealth|Where your inquiries come from|Recent inquiries/);
  });

  it("setup page explains each source once with setup actions (no summary list)", () => {
    const stage = readFileSync(
      resolve("components/setup-hub/lead-capture-stage.tsx"),
      "utf8",
    );
    const forms = readFileSync(
      resolve("components/settings/website-forms-section.tsx"),
      "utf8",
    );
    assert.doesNotMatch(forms, /Lead sources/);
    assert.doesNotMatch(stage, /Lead sources/);
    assert.doesNotMatch(stage, /More lead sources/);
    assert.match(stage, /Facebook \/ Instagram/);
    assert.match(stage, /Connect Facebook and Instagram to bring Lead Ads into your Leads pipeline\./);
    assert.match(stage, /\/settings\/integrations/);
    assert.match(stage, /QR campaigns/);
    assert.match(stage, /Manual entry/);
    assert.match(stage, /\/leads\/new/);
    assert.match(stage, /Tour requests/);
    assert.match(forms, /EmailIntakeSection/);
  });
});
