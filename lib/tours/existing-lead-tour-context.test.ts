import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import { createTourOriginToken } from "@/lib/tours/origin-context";
import { shouldSkipPreferredEventDateRequirement } from "@/lib/tours/existing-lead-tour-context";

describe("existing-lead tour preferred event date", () => {
  it("skips preferred-date requirement for all schedule_tour modes (not Request Information)", () => {
    assert.equal(
      shouldSkipPreferredEventDateRequirement({
        mode: "schedule_tour",
        existingLeadTour: true,
      }),
      true,
    );
    assert.equal(
      shouldSkipPreferredEventDateRequirement({
        mode: "schedule_tour",
        existingLeadTour: false,
      }),
      true,
    );
    assert.equal(
      shouldSkipPreferredEventDateRequirement({
        mode: "request_information",
        existingLeadTour: true,
      }),
      false,
    );
    assert.equal(
      shouldSkipPreferredEventDateRequirement({
        mode: "request_information",
        existingLeadTour: false,
      }),
      false,
    );
  });

  it("book page resolves server context from origin token and passes it to InquiryForm", () => {
    const book = readFileSync(resolve("app/book/[key]/page.tsx"), "utf8");
    assert.match(book, /resolveExistingLeadTourContext/);
    assert.match(book, /existingLeadTour=\{existingLeadTour\}/);
    assert.doesNotMatch(book, /leadId=\{/);
    // Anonymous RLS cannot select venues; page must resolve embed_key via admin.
    assert.match(book, /createAdminClient/);
  });

  it("InquiryForm shows read-only preferred date for existing-lead tour and does not use availability calendar", () => {
    const form = readFileSync(resolve("components/form/inquiry-form.tsx"), "utf8");
    assert.match(form, /existing-lead-preferred-event-date/);
    assert.match(form, /shouldSkipPreferredEventDateRequirement/);
    assert.match(form, /You do not\s+need to select it again/);
    const start = form.indexOf('data-testid="existing-lead-preferred-event-date"');
    assert.ok(start > 0);
    const existingBlock = form.slice(start, start + 1200);
    assert.doesNotMatch(existingBlock, /AvailabilityCalendar/);
    assert.doesNotMatch(existingBlock, /type="date"/);
    assert.match(existingBlock, /No preferred event date is on file yet/);
  });

  it("locks existing-lead links to schedule_tour and never seeds held preferred date into eventDate", () => {
    const form = readFileSync(resolve("components/form/inquiry-form.tsx"), "utf8");
    assert.match(form, /lockedExistingLeadTour/);
    assert.match(form, /if \(existingLeadTour\?\.hasExistingLead\) return "schedule_tour"/);
    assert.match(form, /if \(existingLeadTour\?\.hasExistingLead\) return ""/);
    assert.match(form, /const submitEventDate = existingLeadScheduleTour \? "" : eventDate/);
    assert.match(form, /!lockedExistingLeadTour && \(/);
    assert.match(form, /existingLeadTour\?\.guestCount/);
    assert.match(form, /mode === "schedule_tour" \? "optional"/);
  });

  it("Calendar and lead surfaces distinguish general tour link vs personal scheduling link", () => {
    const calendar = readFileSync(resolve("components/calendar/share-tour-availability.tsx"), "utf8");
    assert.match(calendar, /calendar-tour-link-lead-guidance/);
    assert.match(calendar, /Copy scheduling link/);
    const panel = readFileSync(resolve("components/leads/tour-panel.tsx"), "utf8");
    assert.match(panel, /lead-scheduling-link-guidance/);
    assert.match(panel, /Copy tour link/);
  });

  it("book_public_tour_for_lead copies lead.event_date onto the appointment and never updates leads", () => {
    const sql = readFileSync(
      resolve("supabase/migrations/20261412400000_book_public_tour_for_lead.sql"),
      "utf8",
    );
    assert.match(sql, /v_lead\.event_date::text/);
    assert.doesNotMatch(sql, /update\s+public\.leads/i);
    assert.doesNotMatch(sql, /date_holds|release_hold|consume.*hold/i);
  });

  it("attach path in bookTour does not call ingestLead", () => {
    const service = readFileSync(resolve("lib/tours/service.ts"), "utf8");
    const attachFn = service.slice(
      service.indexOf("async function bookPublicTourOntoExistingLead"),
      service.indexOf("export async function bookTour"),
    );
    assert.match(attachFn, /book_public_tour_for_lead/);
    assert.doesNotMatch(attachFn, /ingestLead/);
  });

  it("protected attach stores authoritative lead event_date, not client field", () => {
    const protection = readFileSync(resolve("lib/tours/protection.ts"), "utf8");
    assert.match(protection, /attachEventDate/);
    assert.match(
      protection,
      /event_date:\s*attachedExistingLead\s*\?\s*attachEventDate/,
    );
  });

  it("origin token remains HMAC-bound (no raw leadId query param)", () => {
    const secret = "test-existing-lead-tour-secret-32chars!!";
    const token = createTourOriginToken(
      { venueId: "venue-1", leadId: "lead-1", nowMs: 1_000, ttlMs: 60_000 },
      secret,
    );
    assert.match(token, /^v1\./);
    assert.doesNotMatch(token, /leadId=/);
    const link = readFileSync(resolve("lib/tours/public-link.ts"), "utf8");
    assert.match(link, /\?o=/);
  });

  it("blocked-date inquiry migration remains the authority for new inquiries", () => {
    const mig = readFileSync(
      resolve("supabase/migrations/20261415000000_inquiry_honors_tour_blocked_dates.sql"),
      "utf8",
    );
    assert.match(mig, /_is_event_date_available/);
    assert.match(mig, /tour_availability_exceptions/);
  });
});
