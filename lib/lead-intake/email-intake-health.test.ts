import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { buildEmailIntakeHealthView } from "@/lib/lead-intake/email-intake-health";

const healthSrc = readFileSync(resolve("lib/lead-intake/email-intake-health.ts"), "utf8");
const uiSrc = readFileSync(resolve("components/settings/email-intake-health.tsx"), "utf8");
const sectionSrc = readFileSync(resolve("components/settings/email-intake-section.tsx"), "utf8");
const settingsSrc = readFileSync(resolve("app/(app)/settings/leads/page.tsx"), "utf8");

describe("email intake health view", () => {
  it("maps parse failure, lead-creation failure, rate limit, and a recorded success", () => {
    const view = buildEmailIntakeHealthView([
      {
        id: "a",
        status: "rejected_invalid",
        created_at: "2026-10-19T18:00:00.000Z",
        external_ref: "198f4832-cd95-4d76-a9c4-62c2d83f9c24",
        error_message: "No readable text in this email.",
      },
      {
        id: "b",
        status: "error",
        created_at: "2026-10-19T17:00:00.000Z",
        external_ref: null,
        error_message: "duplicate key value violates unique constraint leads_pkey",
      },
      {
        id: "c",
        status: "rejected_rate_limited",
        created_at: "2026-10-19T16:00:00.000Z",
        external_ref: "not-a-message-id",
        error_message: "venue window exceeded: 40/30",
      },
      {
        id: "d",
        status: "accepted",
        created_at: "2026-10-19T15:00:00.000Z",
        external_ref: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        error_message: null,
      },
      {
        id: "e",
        status: "received",
        created_at: "2026-10-19T19:00:00.000Z",
        external_ref: "11111111-2222-3333-4444-555555555555",
        error_message: null,
      },
    ]);

    assert.equal(view.hasActivity, true);
    assert.equal(view.latestSuccessAt, "2026-10-19T15:00:00.000Z");
    assert.equal(view.latestIssueAt, "2026-10-19T18:00:00.000Z");
    assert.equal(view.issues.length, 3);
    assert.equal(view.issues[0]?.statusLabel, "Could not read this message");
    assert.match(view.issues[0]?.detail ?? "", /no readable text/i);
    assert.equal(view.issues[0]?.reference, "d83f9c24");
    assert.equal(view.issues[1]?.statusLabel, "Did not become a lead");
    assert.doesNotMatch(view.issues[1]?.detail ?? "", /duplicate key|constraint|leads_pkey/);
    assert.equal(view.issues[2]?.statusLabel, "Too many messages at once");
    assert.equal(view.issues[2]?.reference, null);
    assert.doesNotMatch(JSON.stringify(view), /venue window exceeded/);
    assert.equal(view.issues.some((issue) => issue.id === "e"), false);
    assert.equal(view.issues.some((issue) => issue.id === "d"), false);
  });

  it("uses a calm empty view when nothing is recorded", () => {
    const view = buildEmailIntakeHealthView([]);
    assert.deepEqual(view, {
      hasActivity: false,
      latestSuccessAt: null,
      latestIssueAt: null,
      issues: [],
    });
  });

  it("does not return message bodies, headers, or sender addresses", () => {
    const view = buildEmailIntakeHealthView([
      {
        id: "a",
        status: "rejected_invalid",
        created_at: "2026-10-19T18:00:00.000Z",
        external_ref: "198f4832-cd95-4d76-a9c4-62c2d83f9c24",
        error_message: "From: secret@example.com\nSubject: wedding\nBody: please book us",
      },
    ]);
    const rendered = JSON.stringify(view);
    assert.doesNotMatch(rendered, /secret@example.com|Subject:|please book us/);
    assert.equal(view.issues[0]?.detail.includes("@"), false);
  });

  it("is mounted on Leads settings and stays scoped to the session venue", () => {
    assert.match(sectionSrc, /EmailIntakeHealth/);
    assert.match(settingsSrc, /getEmailIntakeHealth/);
    assert.match(healthSrc, /getCurrentVenue\(\)/);
    assert.match(healthSrc, /\.eq\("venue_id", venue\.id\)/);
    assert.match(healthSrc, /\.eq\("trust_tier", "email_parsed"\)/);
    assert.doesNotMatch(healthSrc, /export async function getEmailIntakeHealth\(\s*venueId/);
    assert.match(healthSrc, /\.select\("id, status, created_at, external_ref, error_message"\)/);
    assert.doesNotMatch(healthSrc, /\.select\([^)]*raw_payload|\.select\([^)]*normalized_payload|\.select\([^)]*ip_address/);
    assert.doesNotMatch(uiSrc, /raw_payload|normalized_payload|svix-|stack|error_message/);
    assert.doesNotMatch(uiSrc, /marketplace is connected|all incoming|guaranteed/i);
    assert.match(uiSrc, /does not\s+confirm that a marketplace sent an inquiry/);
  });
});
