import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("venue client-facing availability paths", () => {
  const bookPage = readFileSync(resolve("app/book/[key]/page.tsx"), "utf8");
  const tourSlots = readFileSync(resolve("app/api/tours/slots/route.ts"), "utf8");
  const tourService = readFileSync(resolve("lib/tours/service.ts"), "utf8");
  const inquiryForm = readFileSync(resolve("components/form/inquiry-form.tsx"), "utf8");
  const inquiryDates = readFileSync(resolve("app/api/public/inquiry-available-dates/route.ts"), "utf8");
  const inquirySql = readFileSync(resolve("supabase/migrations/20261309000000_inquiry_form_config.sql"), "utf8");
  const tourSql = readFileSync(resolve("supabase/migrations/20260922000000_coordinator_tour_scheduling.sql"), "utf8");

  it("Book a Tour is gated by tour_scheduling_enabled and uses get_tour_slots", () => {
    assert.match(bookPage, /tour_embed_key/);
    assert.match(bookPage, /tour_scheduling_enabled", true/);
    assert.match(bookPage, /initialMode="schedule_tour"/);
    assert.match(tourSlots, /getTourSlots/);
    assert.match(tourService, /get_tour_slots/);
    assert.match(inquiryForm, /\/api\/tours\/slots/);
    assert.match(tourSql, /tour_scheduling_enabled/);
    assert.match(tourSql, /get_tour_slots/);
  });

  it("public event-date inquiry uses inquiry_event_date_mode and get_available_event_dates", () => {
    assert.match(inquiryForm, /inquiryEventDateMode === "choose_available"/);
    assert.match(inquiryForm, /\/api\/public\/inquiry-available-dates/);
    assert.match(inquiryDates, /get_available_event_dates/);
    assert.match(inquirySql, /availability_not_enabled/);
    assert.match(inquirySql, /choose_available/);
  });

  it("visibility settings actually gate those public queries", () => {
    assert.match(bookPage, /if \(!config\.tourSchedulingEnabled\)/);
    assert.match(inquiryForm, /fields\.preferred_event_date === "hidden"/);
    assert.match(inquirySql, /inquiry_event_date_mode/);
  });
});
