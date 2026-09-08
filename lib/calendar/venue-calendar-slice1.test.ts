/**
 * Calendar Slice 1 — venue Calendar boundary + Tour/Tasting picker + filters.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  isCreatableManualScheduleType,
  LEGACY_MANUAL_SCHEDULE_TYPE_LABELS,
  MANUAL_SCHEDULE_TYPE_OPTIONS,
  manualScheduleTypeLabel,
} from "@/lib/availability/constants";
import { MANUAL_SCHEDULE_TYPE_GROUPS } from "@/lib/availability/types";
import { PERSPECTIVES } from "@/components/calendar/perspectives";
import { CALENDAR_FILTER_STORAGE_KEY } from "@/components/calendar/use-calendar-filters";
import {
  isVenueCalendarItemType,
  sanitizeVenueCalendarFilters,
  VENUE_CALENDAR_EXCLUDED_ITEM_TYPES,
  VENUE_CALENDAR_ITEM_TYPES,
} from "@/lib/calendar/venue-calendar-scope";
import type { CalendarItemType } from "@/lib/calendar/types";
import { venueCalendarLegendEntries } from "@/components/calendar/calendar-shared";

const serviceSrc = readFileSync(resolve("lib/calendar/service.ts"), "utf8");
const bookingSrc = readFileSync(resolve("lib/calendar/booking-schedule.ts"), "utf8");
const pageSrc = readFileSync(resolve("app/(app)/calendar/page.tsx"), "utf8");
const calendarViewSrc = readFileSync(resolve("components/calendar/calendar-view.tsx"), "utf8");
const filtersSrc = readFileSync(resolve("components/calendar/use-calendar-filters.ts"), "utf8");
const sharedSrc = readFileSync(resolve("components/calendar/calendar-shared.tsx"), "utf8");
const availServiceSrc = readFileSync(resolve("lib/availability/service.ts"), "utf8");

describe("Calendar Slice 1 — venue aggregation boundary", () => {
  it("venue Calendar KEEP types are documented and recognized", () => {
    for (const t of VENUE_CALENDAR_ITEM_TYPES) {
      assert.equal(isVenueCalendarItemType(t), true);
    }
    assert.deepEqual([...VENUE_CALENDAR_ITEM_TYPES], [
      "event", "tour", "date_hold", "calendar_block", "planning_activity",
    ]);
  });

  it("excluded dated-work types are not venue Calendar types", () => {
    for (const t of VENUE_CALENDAR_EXCLUDED_ITEM_TYPES) {
      assert.equal(isVenueCalendarItemType(t as CalendarItemType), false);
    }
  });

  it("getCalendarData no longer queries moved-off sources", () => {
    // Related-to search still reads leads/clients; aggregation must not.
    const aggregation = serviceSrc.slice(serviceSrc.indexOf("export async function getCalendarData"));
    assert.doesNotMatch(aggregation, /follow_up_date/);
    assert.doesNotMatch(aggregation, /payment_line_items/);
    assert.doesNotMatch(aggregation, /client_key_dates/);
    assert.doesNotMatch(aggregation, /from\("requests"\)/);
    assert.doesNotMatch(aggregation, /from\("contracts"\)/);
    assert.doesNotMatch(aggregation, /from\("documents"\)/);
    assert.doesNotMatch(aggregation, /from\("leads"\)/);
    assert.doesNotMatch(aggregation, /type: "follow_up"/);
    assert.doesNotMatch(aggregation, /type: "payment_due"/);
    assert.doesNotMatch(aggregation, /type: "key_date"/);
    assert.doesNotMatch(aggregation, /type: "request_due"/);
    assert.doesNotMatch(aggregation, /type: "contract_expiration"/);
    assert.doesNotMatch(aggregation, /type: "document_expiration"/);
  });

  it("getCalendarData still aggregates KEEP sources", () => {
    assert.match(serviceSrc, /from\("events"\)/);
    assert.match(serviceSrc, /getTourCalendarEntries/);
    assert.match(serviceSrc, /from\("date_holds"\)/);
    assert.match(serviceSrc, /from\("calendar_blocks"\)/);
    assert.match(serviceSrc, /from\("event_tasks"\)/);
    assert.match(serviceSrc, /scheduled_date/);
    assert.match(serviceSrc, /type: "planning_activity"/);
  });

  it("Booking Schedule still includes due dates and planning tasks", () => {
    assert.match(bookingSrc, /type: "payment_due"/);
    assert.match(bookingSrc, /type: "request_due"/);
    assert.match(bookingSrc, /type: "planning_task"/);
    assert.match(bookingSrc, /type: "timeline_entry"/);
    assert.match(bookingSrc, /type: "contract_expiration"/);
    assert.match(bookingSrc, /type: "document_expiration"/);
  });
});

describe("Calendar Slice 1 — Tour / Tasting manual types", () => {
  it("Tour and Tasting are not hardcoded creatable Schedule Item options", () => {
    const values = MANUAL_SCHEDULE_TYPE_OPTIONS.map((o) => o.value);
    assert.equal(values.includes("tour"), false);
    assert.equal(values.includes("tasting"), false);
    assert.equal(isCreatableManualScheduleType("tour"), false);
    assert.equal(isCreatableManualScheduleType("tasting"), false);
    assert.equal(isCreatableManualScheduleType("consultation"), true);
    assert.equal(isCreatableManualScheduleType("blocked_time"), true);
  });

  it("fallback picker groups omit Tour and Tasting", () => {
    const all = MANUAL_SCHEDULE_TYPE_GROUPS.flatMap((g) => g.types);
    assert.equal(all.includes("tour"), false);
    assert.equal(all.includes("tasting"), false);
  });

  it("legacy labels remain for existing manual Tour rows; Tasting uses clear name", () => {
    assert.match(LEGACY_MANUAL_SCHEDULE_TYPE_LABELS.tour ?? "", /not a booked tour/i);
    assert.match(manualScheduleTypeLabel("tour"), /not a booked tour/i);
    assert.match(manualScheduleTypeLabel("tasting"), /^Tasting$/);
  });

  it("createBlock rejects Tour; catalog resolve gates builtins including Tasting", () => {
    assert.match(availServiceSrc, /isAppointmentCatalogBuiltinKey|isCatalogOrSystemWritableType/);
    assert.match(availServiceSrc, /isLegacyOnlyManualScheduleType/);
    assert.match(availServiceSrc, /Book tours from Tours/);
    assert.match(availServiceSrc, /resolveScheduleCatalogWrite/);
  });

  it("manual Tour presentation is disambiguated from booked tours", () => {
    assert.match(serviceSrc, /Manual schedule — not a booked tour/);
    assert.match(sharedSrc, /Manual tour \(not booked\)/);
    assert.doesNotMatch(sharedSrc, /tour:\s*TYPE_META\.tour/);
  });

  it("booking placeholders do not reuse Event visual identity", () => {
    assert.doesNotMatch(sharedSrc, /wedding_event_booking:\s*TYPE_META\.event/);
    assert.doesNotMatch(sharedSrc, /private_event:\s*TYPE_META\.event/);
    assert.match(sharedSrc, /Reserved date/);
    assert.match(serviceSrc, /Reserved date/);
  });
});

describe("Calendar Slice 1 — perspectives, copy, filters, help", () => {
  it("perspectives do not reintroduce moved-off item types", () => {
    for (const p of PERSPECTIVES) {
      for (const t of p.filters.types ?? []) {
        assert.equal(isVenueCalendarItemType(t), true, `${p.id} includes non-venue type ${t}`);
      }
      assert.equal((p.filters.manualTypes ?? []).includes("tour"), false, `${p.id} manual tour`);
    }
    assert.equal(PERSPECTIVES.some((p) => (p.id as string) === "finance"), false);
  });

  it("Calendar page copy describes schedule, not every dated fact", () => {
    assert.doesNotMatch(pageSrc, /Every important date/);
    assert.doesNotMatch(pageSrc, /across your events, leads, and clients/);
    assert.match(pageSrc, /schedule/i);
    assert.doesNotMatch(pageSrc, /understanding-your-calendar/);
    assert.doesNotMatch(pageSrc, /SetupGuideLink/);
  });

  it("empty state no longer tells users to add a tour via Schedule Item", () => {
    assert.doesNotMatch(calendarViewSrc, /add a tour, hold, or block/i);
    assert.match(calendarViewSrc, /Add a schedule item/);
  });

  it("filters share one localStorage key across views", () => {
    assert.equal(CALENDAR_FILTER_STORAGE_KEY, "shared");
    assert.match(filtersSrc, /CALENDAR_FILTER_STORAGE_KEY = "shared"/);
    assert.match(readFileSync(resolve("components/calendar/week-view.tsx"), "utf8"), /useCalendarFilters\(items\)/);
    assert.match(readFileSync(resolve("components/calendar/day-view.tsx"), "utf8"), /useCalendarFilters\(items\)/);
    assert.match(readFileSync(resolve("components/calendar/agenda-view.tsx"), "utf8"), /useCalendarFilters\(items\)/);
    assert.match(calendarViewSrc, /useCalendarFilters\(items\)/);
  });

  it("sanitizeVenueCalendarFilters strips excluded types and legacy manual tour", () => {
    const cleaned = sanitizeVenueCalendarFilters({
      types: ["event", "payment_due", "follow_up", "key_date"] as CalendarItemType[],
      manualTypes: ["tour", "consultation", "tasting"] as never,
      staffId: null,
      spaceId: null,
    });
    assert.deepEqual(cleaned.types, ["event"]);
    assert.deepEqual(cleaned.manualTypes, ["consultation", "tasting"]);
  });

  it("venue Calendar legend never teaches excluded taxonomy", () => {
    const labels = venueCalendarLegendEntries().map((e) => e.label);
    for (const banned of [
      "Follow-up",
      "Payment Due",
      "Key Date",
      "Request",
      "Contract Expires",
      "Document Expires",
      "Planning Task",
      "Timeline",
      "Meeting",
    ]) {
      assert.equal(labels.includes(banned), false, `legend must not include ${banned}`);
    }
    assert.ok(labels.includes("Event"));
    assert.ok(labels.includes("Tour"));
    assert.ok(labels.includes("Date Hold"));
    assert.ok(labels.includes("Blocked Time"));
    assert.ok(labels.includes("Planning"));
    assert.ok(labels.includes("Consultation"));
    assert.ok(labels.includes("Client Meeting"));
    assert.doesNotMatch(calendarViewSrc, /Object\.entries\(TYPE_META\)\s*as/);
    assert.match(calendarViewSrc, /venueCalendarLegendEntries\(\)/);
    assert.doesNotMatch(calendarViewSrc, /LEGEND_MANUAL_EXTRAS/);
    assert.match(sharedSrc, /for \(const type of VENUE_CALENDAR_ITEM_TYPES\)/);
    assert.match(sharedSrc, /for \(const manual of VENUE_CALENDAR_LEGEND_MANUAL_TYPES\)/);
  });

  it("FilterBar and presentTypes harden against excluded types", () => {
    assert.match(sharedSrc, /venuePresentTypes = presentTypes\.filter\(isVenueCalendarItemType\)/);
    assert.match(filtersSrc, /isVenueCalendarItemType/);
  });

  it("month detail selection resets when navigating to another month", () => {
    assert.match(calendarViewSrc, /prev\.startsWith\(prefix\)/);
    assert.match(calendarViewSrc, /\[view, year, month, today\]/);
  });
});
