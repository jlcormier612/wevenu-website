/**
 * Possible-duplicate inquiry UX seams — detection + guidance, no merge.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const migration = readFileSync(
  resolve("supabase/migrations/20261377000000_lead_duplicate_reviews.sql"),
  "utf8",
);
const pipeline = readFileSync(resolve("lib/lead-intake/pipeline.ts"), "utf8");
const review = readFileSync(resolve("lib/leads/duplicate-review.ts"), "utf8");
const banner = readFileSync(resolve("components/leads/possible-duplicate-banner.tsx"), "utf8");
const createDlg = readFileSync(resolve("components/leads/possible-match-create-dialog.tsx"), "utf8");
const bell = readFileSync(resolve("components/shell/notification-bell.tsx"), "utf8");
const detection = readFileSync(resolve("lib/leads/duplicate-detection.ts"), "utf8");

describe("Possible duplicate inquiry seams", () => {
  it("stores venue-only reviews without Relationship merge", () => {
    assert.match(migration, /lead_duplicate_reviews/);
    assert.match(migration, /needs_review/);
    assert.match(migration, /kept_separate/);
    assert.match(migration, /No Relationship merge/);
  });

  it("forwards partner last/email on public inquire so name-pair and partner-email can fire", () => {
    const inquire = readFileSync(resolve("app/api/public/inquire/route.ts"), "utf8");
    assert.match(inquire, /partnerLastName:\s*partnerLast/);
    assert.match(inquire, /partnerEmail:\s*partnerEmail/);
  });

  it("runs private post-create detection only for external trust tiers", () => {
    assert.match(pipeline, /maybeCreateDuplicateReviewForNewLead/);
    assert.match(pipeline, /trustTier === "direct"/);
    assert.match(pipeline, /trustTier === "webhook"/);
    assert.match(pipeline, /Possible-duplicate review failed/);
  });

  it("never re-parents Leads or merges Relationships in review helpers", () => {
    assert.doesNotMatch(review, /relationship_id:\s*matched/);
    assert.doesNotMatch(review, /\.update\(\{[\s\S]*relationship_id/);
    assert.match(review, /never merges Relationships/);
    assert.match(banner, /does not automatically merge/);
    assert.match(banner, /Delete this duplicate lead/);
  });

  it("venue create warning is non-blocking", () => {
    assert.match(createDlg, /Create anyway/);
    assert.match(createDlg, /never blocks create|Go back/i);
  });

  it("notification CTA uses existing venue inbox", () => {
    assert.match(bell, /possible_duplicate_inquiry/);
    assert.match(bell, /Review possible duplicate/);
  });

  it("rejects fuzzy matching language in the detector", () => {
    assert.doesNotMatch(detection, /levenshtein|soundex|string.?similarity/i);
    assert.match(detection, /never fuzzy names/);
  });
});
