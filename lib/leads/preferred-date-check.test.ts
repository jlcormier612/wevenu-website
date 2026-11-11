import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import type { AvailabilityStatus } from "@/lib/availability/types";
import {
  PREFERRED_EVENT_DATE_HINT,
  PREFERRED_EVENT_DATE_LABEL,
  blockingPreferredDateConflicts,
  isStalePreferredDateResult,
  preferredDateOverrideValid,
  saveMaySkipPreferredDateDialog,
} from "@/lib/leads/preferred-date-check";

const form = readFileSync(resolve("components/leads/new-inquiry-form.tsx"), "utf8");
const panel = readFileSync(resolve("components/leads/preferred-date-conflict-panel.tsx"), "utf8");
const dialog = readFileSync(resolve("components/leads/lead-date-unavailable-dialog.tsx"), "utf8");
const helper = readFileSync(resolve("lib/leads/preferred-date-check.ts"), "utf8");

describe("preferred-date-check helpers", () => {
  it("labels Preferred event date and explains it does not reserve", () => {
    assert.equal(PREFERRED_EVENT_DATE_LABEL, "Preferred event date");
    assert.equal(
      PREFERRED_EVENT_DATE_HINT,
      "This is the date the prospect prefers. It does not reserve or book the date.",
    );
    assert.match(form, /PREFERRED_EVENT_DATE_LABEL/);
    assert.match(form, /PREFERRED_EVENT_DATE_HINT/);
    assert.match(form, /PreferredDateConflictPanel/);
    assert.match(panel, /does not reserve or book/);
  });

  it("blockingPreferredDateConflicts keeps only error severity", () => {
    const status: AvailabilityStatus = {
      available: false,
      conflicts: [
        { type: "hold_exists", message: "hold", severity: "error" },
        { type: "hold_exists", message: "soft", severity: "warning" },
      ],
    };
    assert.equal(blockingPreferredDateConflicts(status).length, 1);
    assert.equal(blockingPreferredDateConflicts(null).length, 0);
  });

  it("stale async responses cannot overwrite the current selection", () => {
    assert.equal(isStalePreferredDateResult(1, 2, "2030-01-01", "2030-01-01"), true);
    assert.equal(isStalePreferredDateResult(2, 2, "2030-01-01", "2030-02-01"), true);
    assert.equal(isStalePreferredDateResult(2, 2, "2030-01-01", "2030-01-01"), false);
  });

  it("date change invalidates override for a previous date", () => {
    assert.equal(preferredDateOverrideValid("2030-01-01", "2030-01-01"), true);
    assert.equal(preferredDateOverrideValid("2030-01-01", "2030-02-01"), false);
    assert.equal(preferredDateOverrideValid(null, "2030-01-01"), false);
  });

  it("save skips dialog only with matching override or no blocking conflicts", () => {
    const blocking = [{ type: "hold_exists" as const, message: "x", severity: "error" as const }];
    assert.equal(
      saveMaySkipPreferredDateDialog({ date: "2030-01-01", acknowledgedDate: "2030-01-01", blocking }),
      true,
    );
    assert.equal(
      saveMaySkipPreferredDateDialog({ date: "2030-01-01", acknowledgedDate: null, blocking }),
      false,
    );
    assert.equal(
      saveMaySkipPreferredDateDialog({ date: "2030-01-01", acknowledgedDate: "2030-02-01", blocking }),
      false,
    );
    assert.equal(
      saveMaySkipPreferredDateDialog({ date: "2030-01-01", acknowledgedDate: null, blocking: [] }),
      true,
    );
  });
});

describe("New Lead preferred-date wiring", () => {
  it("checks preferred_date on select and on save; never hard-disables dates", () => {
    assert.match(form, /runPreferredDateCheck/);
    assert.match(form, /setPreferredEventDate/);
    assert.match(form, /purpose:\s*"preferred_date"/);
    assert.match(form, /checkPreferredDateThenSave/);
    assert.match(form, /saveMaySkipPreferredDateDialog/);
    assert.match(form, /isStalePreferredDateResult/);
    assert.match(form, /setAcknowledgedPreferredDate\(null\)/);
    assert.doesNotMatch(form, /disabled=\{[^}]*preferredCheck/);
    assert.doesNotMatch(form, /from\("date_holds"\)|from\("calendar_blocks"\)/);
  });

  it("inline panel and save dialog expose choose / keep actions", () => {
    assert.match(panel, /Choose another date/);
    assert.match(panel, /Keep this preferred date/);
    assert.match(panel, /data-testid="preferred-date-conflict"/);
    assert.match(dialog, /Choose another date/);
    assert.match(dialog, /Keep this preferred date/);
    assert.match(dialog, /does not reserve or book the date/);
  });

  it("create path stays soft — create_lead_atomic only, no Hold/Booked side effects in form", () => {
    assert.match(form, /createLeadAction/);
    assert.doesNotMatch(form, /createDateHold|placeHold|book_relationship|bookRelationship/);
    assert.match(helper, /Availability interpretation stays in checkAvailability/);
  });
});
