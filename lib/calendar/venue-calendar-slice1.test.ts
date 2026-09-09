/**
 * Calendar Slice 1 — venue Calendar boundary + Tour/Tasting + F01–F06 corrections.
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
import { getPerspectives, PERSPECTIVES } from "@/components/calendar/perspectives";
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
const perspectivesSrc = readFileSync(resolve("components/calendar/perspectives.ts"), "utf8");

describe("Calendar Slice 1 — venue aggregation boundary", () => {
  it("venue Calendar KEEP types are documented and recognized", () => {
    for (const t of VENUE_CALENDAR_ITEM_TYPES) {
      assert.equal(isVenueCalendarItemType(t), true);
    }
    assert.deepEqual([...VENUE_CALENDAR_ITEM_TYPES], [
      "event", "tour", "date_hold", "calendar_block",
    ]);
  });

  it("excluded dated-work types are not venue Calendar types", () => {
    for (const t of VENUE_CALENDAR_EXCLUDED_ITEM_TYPES) {
      assert.equal(isVenueCalendarItemType(t as CalendarItemType), false);
    }
    assert.equal(isVenueCalendarItemType("planning_activity"), false);
  });

  it("getCalendarData no longer queries moved-off sources", () => {
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

  it("getCalendarData aggregates schedule/availability sources only — no planning_activity", () => {
    const aggregation = serviceSrc.slice(serviceSrc.indexOf("export async function getCalendarData"));
    assert.match(aggregation, /from\("events"\)/);
    assert.match(aggregation, /getTourCalendarEntries/);
    assert.match(aggregation, /from\("date_holds"\)/);
    assert.match(aggregation, /from\("calendar_blocks"\)/);
    assert.doesNotMatch(aggregation, /from\("event_tasks"\)/);
    assert.doesNotMatch(aggregation, /scheduled_date/);
    assert.doesNotMatch(aggregation, /type: "planning_activity"/);
  });

  it("Booking Schedule still includes due dates and planning tasks", () => {
    assert.match(bookingSrc, /type: "payment_due"/);
    assert.match(bookingSrc, /type: "request_due"/);
    assert.match(bookingSrc, /type: "planning_task"/);
    assert.match(bookingSrc, /type: "timeline_entry"/);
    assert.match(bookingSrc, /type: "contract_expiration"/);
    assert.match(bookingSrc, /type: "document_expiration"/);
    assert.match(bookingSrc, /type: "planning_activity"/);
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
    // Manual TYPE meta must not alias the booked-tour visual identity.
    assert.doesNotMatch(sharedSrc, /tour:\s*TYPE_META\.tour\s*[,}]/);
    assert.match(sharedSrc, /tour:\s*\{\s*label:\s*"Manual tour \(not booked\)"/);
  });

  it("booking placeholders use Hold taxonomy — not Reserved date", () => {
    assert.doesNotMatch(sharedSrc, /wedding_event_booking:\s*TYPE_META\.event/);
    assert.doesNotMatch(sharedSrc, /private_event:\s*TYPE_META\.event/);
    assert.doesNotMatch(sharedSrc, /Reserved date/);
    assert.doesNotMatch(serviceSrc, /Reserved date/);
    assert.match(sharedSrc, /label: "Hold"/);
    assert.match(serviceSrc, /\["Hold"\]/);
  });
});

describe("Calendar Slice 1 — perspectives, copy, filters, help", () => {
  it("perspectives do not reintroduce moved-off item types or planning_activity", () => {
    for (const p of PERSPECTIVES) {
      for (const t of p.filters.types ?? []) {
        assert.equal(isVenueCalendarItemType(t), true, `${p.id} includes non-venue type ${t}`);
        assert.notEqual(t, "planning_activity");
      }
      assert.equal((p.filters.manualTypes ?? []).includes("tour"), false, `${p.id} manual tour`);
      assert.equal((p.filters.manualTypes ?? []).includes("tasting"), false, `${p.id} tasting default`);
    }
    assert.equal(PERSPECTIVES.some((p) => (p.id as string) === "finance"), false);
  });

  it("getPerspectives adds tasting only when enabled", () => {
    const off = getPerspectives(false);
    const on = getPerspectives(true);
    assert.equal(off.find((p) => p.id === "sales")!.filters.manualTypes?.includes("tasting"), false);
    assert.equal(on.find((p) => p.id === "sales")!.filters.manualTypes?.includes("tasting"), true);
    assert.equal(on.find((p) => p.id === "planning")!.filters.manualTypes?.includes("tasting"), true);
    assert.match(perspectivesSrc, /getPerspectives/);
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
      types: ["event", "payment_due", "follow_up", "key_date", "planning_activity"] as CalendarItemType[],
      manualTypes: ["tour", "consultation", "tasting"] as never,
      staffId: null,
      spaceId: null,
    });
    assert.deepEqual(cleaned.types, ["event"]);
    assert.deepEqual(cleaned.manualTypes, ["consultation", "tasting"]);
  });

  it("venue Calendar legend is locked top-level taxonomy only", () => {
    const off = venueCalendarLegendEntries({ tastingEnabled: false }).map((e) => e.label);
    const on = venueCalendarLegendEntries({ tastingEnabled: true }).map((e) => e.label);
    assert.deepEqual(off, ["Event", "Tour", "Appointment", "Hold", "Blocked Time"]);
    assert.deepEqual(on, ["Event", "Tour", "Appointment", "Hold", "Blocked Time"]);
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
      "Planning",
      "Reserved date",
      "Date Hold",
      "Consultation",
      "Client Meeting",
      "Vendor Meeting",
      "Walkthrough",
      "Tasting",
      "Personal Appointment",
      "Other",
    ]) {
      assert.equal(off.includes(banned), false, `legend must not include ${banned}`);
      assert.equal(on.includes(banned), false, `legend must not include ${banned}`);
    }
    assert.equal(off.filter((l) => l === "Hold").length, 1, "Hold appears once");
    assert.doesNotMatch(calendarViewSrc, /Object\.entries\(TYPE_META\)\s*as/);
    assert.match(calendarViewSrc, /venueCalendarLegendEntries\(\{ tastingEnabled \}\)/);
    assert.match(sharedSrc, /Locked taxonomy/);
    assert.match(sharedSrc, /date_hold:\s*\{\s*label:\s*"Hold"/);
  });

  it("FilterBar uses Appointments & blocks for calendar_block chip", () => {
    assert.match(sharedSrc, /Appointments & blocks/);
    assert.match(sharedSrc, /type === "calendar_block"/);
    assert.match(sharedSrc, /venuePresentTypes = presentTypes\.filter\(isVenueCalendarItemType\)/);
    assert.match(filtersSrc, /isVenueCalendarItemType/);
  });

  it("appointment form: title first, optional type, notes persist", () => {
    assert.match(calendarViewSrc, /OPTIONAL_TYPE_NONE/);
    assert.match(calendarViewSrc, /No classification/);
    assert.match(calendarViewSrc, /Type <span[^>]*>\(optional\)/);
    assert.match(calendarViewSrc, /Title \*/);
    assert.match(calendarViewSrc, /Notes \/ Details/);
    assert.match(calendarViewSrc, /notes: blockNotes/);
    assert.match(calendarViewSrc, /setBlockNotes\(block\.notes/);
    assert.match(calendarViewSrc, /resolvedTypeForSave/);
    assert.match(calendarViewSrc, /type: "other"/);
    // Title field appears before Type label in the form markup.
    const titleAt = calendarViewSrc.indexOf(">Title *</Label>");
    const typeAt = calendarViewSrc.indexOf("Type <span");
    assert.ok(titleAt > 0 && typeAt > titleAt);
  });

  it("no user-facing Reserved date(s) terminology in Calendar UI sources", () => {
    assert.doesNotMatch(sharedSrc, /Reserved date/);
    assert.doesNotMatch(serviceSrc, /Reserved date/);
    assert.doesNotMatch(calendarViewSrc, /Reserved date/);
    assert.doesNotMatch(readFileSync(resolve("lib/calendar/schedule-item-catalog.ts"), "utf8"), /Reserved date/);
    assert.doesNotMatch(readFileSync(resolve("lib/calendar/schedule-item-catalog.ts"), "utf8"), /Reserved & blocked/);
    assert.doesNotMatch(readFileSync(resolve("lib/availability/types.ts"), "utf8"), /Reserved date/);
  });

  it("month detail selection resets when navigating to another month", () => {
    assert.match(calendarViewSrc, /prev\.startsWith\(prefix\)/);
    assert.match(calendarViewSrc, /\[view, year, month, today\]/);
  });
});
