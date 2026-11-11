/**
 * Platform-wide calendar / availability integrity — regression seams.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { buildAvailabilityConflicts } from "@/lib/availability/precheck";
import type { OccupancyEvent } from "@/lib/availability/event-occupancy";

const formLeadMig = readFileSync(
  resolve("supabase/migrations/20261415100000_public_form_lead_honors_event_date_availability.sql"),
  "utf8",
);
const inquiryMig = readFileSync(
  resolve("supabase/migrations/20261415000000_inquiry_honors_tour_blocked_dates.sql"),
  "utf8",
);
const repo = readFileSync(resolve("lib/availability/repository.ts"), "utf8");
const precheck = readFileSync(resolve("lib/availability/precheck.ts"), "utf8");
const publicConstants = readFileSync(resolve("lib/public-forms/constants.ts"), "utf8");
const bookPage = readFileSync(resolve("app/book/[key]/page.tsx"), "utf8");
const existingLead = readFileSync(resolve("lib/tours/existing-lead-tour-context.ts"), "utf8");

const emptySnap = {
  calendarBlocks: [] as never[],
  holdCount: 0,
  holdBlocksAvailability: true,
  rules: { maxSimultaneousEvents: 1, maxSimultaneousTours: 1, minTurnaroundHours: 0 },
  events: [] as OccupancyEvent[],
  activeSpaceIds: [] as string[],
  allSpaceIds: [] as string[],
  tours: [] as never[],
};

describe("platform availability integrity", () => {
  it("create_public_form_lead gates choose_available through _is_event_date_available", () => {
    assert.match(formLeadMig, /create or replace function public\.create_public_form_lead/);
    assert.match(formLeadMig, /inquiry_event_date_mode/);
    assert.match(
      formLeadMig,
      /v_mode = 'choose_available'[\s\S]*_is_event_date_available\(v_form\.venue_id, p_event_date\)/,
    );
    assert.match(formLeadMig, /date_unavailable/);
    assert.match(publicConstants, /date_unavailable/);
  });

  it("inquiry blocked-date authority remains in tip lineage migration", () => {
    assert.match(inquiryMig, /tour_availability_exception_covers_date/);
    assert.match(inquiryMig, /_is_event_date_available/);
  });

  it("staff preferred_date precheck loads annual-aware tour exceptions for events", () => {
    assert.match(repo, /needsTourExceptions/);
    assert.match(repo, /tourExceptionCoversDate/);
    assert.match(repo, /normalizeTourBlockedRecurrence/);
    assert.match(repo, /recurrence_rule/);
    assert.match(precheck, /This date is blocked on the venue calendar/);
  });

  it("preferred_date conflicts when tour Blocked Dates cover the day", () => {
    const status = buildAvailabilityConflicts(
      { date: "2027-12-25", type: "event", purpose: "preferred_date" },
      { ...emptySnap, tourExceptionLabel: "Christmas" },
    );
    assert.equal(status.available, false);
    assert.ok(status.conflicts.some((c) => c.type === "tour_exception" && c.severity === "error"));
    assert.match(
      status.conflicts.find((c) => c.type === "tour_exception")!.message,
      /blocked on the venue calendar \(Christmas\)/i,
    );
  });

  it("existing-lead tour context remains server-resolved without inventing dates", () => {
    assert.match(bookPage, /resolveExistingLeadTourContext/);
    assert.match(bookPage, /createAdminClient/);
    assert.match(existingLead, /preferredEventDate/);
    assert.match(existingLead, /shouldSkipPreferredEventDateRequirement/);
  });
});
