/**
 * Wiring: manual Lead create/update enforce accepted inquiry event types;
 * historical import paths skip the new-record gate.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("manual Lead accepted event-type enforcement wiring", () => {
  const serviceSrc = readFileSync(resolve("lib/leads/service.ts"), "utf8");
  const newPage = readFileSync(resolve("app/(app)/leads/new/page.tsx"), "utf8");
  const newForm = readFileSync(resolve("components/leads/new-inquiry-form.tsx"), "utf8");
  const editPage = readFileSync(resolve("app/(app)/leads/[id]/edit/page.tsx"), "utf8");
  const editForm = readFileSync(resolve("components/leads/lead-edit-form.tsx"), "utf8");
  const calendarPage = readFileSync(resolve("app/(app)/calendar/page.tsx"), "utf8");
  const calendarView = readFileSync(resolve("components/calendar/calendar-view.tsx"), "utf8");
  const clientForm = readFileSync(resolve("components/clients/client-form.tsx"), "utf8");
  const facebook = readFileSync(resolve("lib/facebook/processor.ts"), "utf8");
  const emailExtract = readFileSync(resolve("lib/lead-intake/email-extract.ts"), "utf8");
  const tourScheduler = readFileSync(resolve("components/tours/tour-scheduler.tsx"), "utf8");

  it("createLeadCore gates non-historical creates with assertEventTypeAcceptedForNewRecord", () => {
    assert.match(serviceSrc, /assertEventTypeAcceptedForNewRecord/);
    assert.match(serviceSrc, /if\s*\(\s*!historicalImport\s*\)/);
    assert.match(serviceSrc, /accepted_inquiry_event_types/);
  });

  it("updateLeadInfo uses assertEventTypeChangeAllowed (preserves legacy)", () => {
    assert.match(serviceSrc, /assertEventTypeChangeAllowed/);
  });

  it("Add New Lead uses buildVenueEventTypeOptions, not raw EVENT_TYPES", () => {
    assert.match(newPage, /buildVenueEventTypeOptions/);
    assert.match(newPage, /getInquiryFormSettings/);
    assert.match(newForm, /eventTypeOptions/);
    assert.doesNotMatch(newForm, /options=\{EVENT_TYPES\}/);
  });

  it("Edit Lead uses accepted + current legacy options", () => {
    assert.match(editPage, /buildVenueEventTypeOptions/);
    assert.match(editPage, /currentValue:\s*lead\.eventType/);
    assert.match(editForm, /eventTypeOptions/);
  });

  it("Calendar Hold uses accepted inquiry types (inquiry-equivalent path)", () => {
    assert.match(calendarPage, /bookingEventTypeOptions/);
    assert.match(calendarView, /holdEventTypeOptions/);
    assert.doesNotMatch(calendarView, /items=\{EVENT_TYPES\}/);
  });

  it("Direct New Client remains on global EVENT_TYPES (audit-only, not gated)", () => {
    assert.match(clientForm, /EVENT_TYPES/);
  });

  it("Facebook + email intake remain ungated this patch (follow-up)", () => {
    assert.doesNotMatch(facebook, /assertEventTypeAcceptedForNewRecord/);
    assert.doesNotMatch(emailExtract, /assertEventTypeAcceptedForNewRecord/);
  });

  it("tour-scheduler is marked legacy/unreachable and not venue-aware", () => {
    assert.match(tourScheduler, /LEGACY \/ UNREACHABLE/);
    assert.match(tourScheduler, /buildVenueEventTypeOptions/);
  });
});
