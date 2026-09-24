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
    for (const blob of [health, email, settings]) {
      assert.doesNotMatch(blob, /Lead Intake Health/);
      assert.doesNotMatch(blob, /\bRejected\b/);
      assert.doesNotMatch(blob, /\bErrors\b/);
      assert.doesNotMatch(blob, /Confidence/);
      assert.doesNotMatch(blob, /Last email/);
      assert.doesNotMatch(blob, /Last lead/);
    }
    assert.match(health, /inquiries received in the last 7 days/);
    assert.match(health, /Where your inquiries come from/);
    assert.match(health, /All caught up/);
  });

  it("preserves lead source setup links in website forms section", () => {
    const forms = readFileSync(
      resolve("components/settings/website-forms-section.tsx"),
      "utf8",
    );
    assert.match(forms, /Facebook \/ Instagram Lead Ads/);
    assert.match(forms, /QR code campaigns/);
    assert.match(forms, /Manual entry/);
    assert.match(forms, /Tour requests/);
    assert.match(forms, /Email intake/);
    assert.match(forms, /\/library\/qr-campaigns/);
    assert.match(forms, /\/leads\/new/);
    assert.match(forms, /\/setup-hub\/lead-capture/);
  });
});
