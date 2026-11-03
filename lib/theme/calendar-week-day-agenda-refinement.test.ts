/**
 * Workstream 2B — Calendar Week / Day / Agenda visual refinement.
 * Presentation only; frozen --cal-* taxonomy; no filter/availability/API changes.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const css = readFileSync(resolve("app/globals.css"), "utf8");
const weekView = readFileSync(resolve("components/calendar/week-view.tsx"), "utf8");
const dayView = readFileSync(resolve("components/calendar/day-view.tsx"), "utf8");
const agendaView = readFileSync(resolve("components/calendar/agenda-view.tsx"), "utf8");
const calendarShared = readFileSync(resolve("components/calendar/calendar-shared.tsx"), "utf8");
const filtersHook = readFileSync(resolve("components/calendar/use-calendar-filters.ts"), "utf8");
const venueScope = readFileSync(resolve("lib/calendar/venue-calendar-scope.ts"), "utf8");
const spaceFilter = readFileSync(resolve("lib/calendar/space-filter.ts"), "utf8");
const printPage = readFileSync(resolve("app/(app)/calendar/print/page.tsx"), "utf8");
const shareAvail = readFileSync(resolve("components/calendar/share-availability.tsx"), "utf8");

describe("Calendar Week/Day/Agenda refinement — hospitality chrome", () => {
  it("scopes Week/Day/Agenda roots to Month-aligned hospitality classes", () => {
    assert.match(weekView, /htc-calendar-week/);
    assert.match(dayView, /htc-calendar-day/);
    assert.match(agendaView, /htc-calendar-agenda/);
    // Phase 11C final polish — shared linen toolbar owns date nav (calendar-view).
    const calendarView = readFileSync(resolve("components/calendar/calendar-view.tsx"), "utf8");
    assert.match(calendarView, /htc-calendar-month-nav/);
    assert.match(calendarView, /data-cal-toolbar-row="date"/);
    assert.doesNotMatch(weekView, /htc-calendar-toolbar/);
    assert.doesNotMatch(dayView, /htc-calendar-toolbar/);
    assert.doesNotMatch(agendaView, /htc-calendar-toolbar/);
  });

  it("styles Week day columns with white card + eucalyptus Today", () => {
    assert.match(weekView, /data-cal-week-day/);
    assert.match(weekView, /data-cal-week-day-num/);
    assert.match(
      css,
      /\.htc-staff \.htc-calendar-week \[data-cal-week-day\][\s\S]*?background:\s*var\(--card\)/,
    );
    assert.match(
      css,
      /\[data-cal-week-day\]\[data-today="true"\][\s\S]*?background:\s*var\(--htc-eucalyptus-surface\)/,
    );
    assert.match(
      css,
      /\[data-cal-week-day-num\]\[data-today="true"\][\s\S]*?background:\s*var\(--primary\)/,
    );
    const todayCol = css.slice(
      css.indexOf('.htc-staff .htc-calendar-week [data-cal-week-day][data-today="true"]'),
      css.indexOf(".htc-staff .htc-calendar-week [data-cal-week-day-name]"),
    );
    assert.doesNotMatch(todayCol, /htc-soft-blush|htc-soft-rose|htc-blush|#f7e9eb|#e8c5c8/i);
  });

  it("keeps Week event blocks on taxonomy dots without remapping --cal-*", () => {
    assert.match(weekView, /data-cal-week-event/);
    assert.match(weekView, /meta\.dotColor/);
    assert.match(weekView, /resolveItemMeta/);
  });

  it("gives Day a white schedule board and intentional linen empty state", () => {
    assert.match(dayView, /data-cal-day-board/);
    assert.match(dayView, /data-cal-day-empty/);
    assert.match(
      css,
      /\.htc-staff \.htc-calendar-day \[data-cal-day-board\][\s\S]*?background:\s*var\(--card\)/,
    );
    assert.match(
      css,
      /\.htc-staff \.htc-calendar-day \[data-cal-day-empty\][\s\S]*?background:\s*var\(--htc-linen\)/,
    );
    assert.match(dayView, /Nothing scheduled for this day/);
  });

  it("uses full content width for Day board (matches empty) and associates Today with day nav", () => {
    const calendarView = readFileSync(resolve("components/calendar/calendar-view.tsx"), "utf8");
    const boardBlock = css.slice(
      css.indexOf(".htc-staff .htc-calendar-day [data-cal-day-board] {"),
      css.indexOf(".htc-staff [data-cal-day-nav]"),
    );
    assert.match(boardBlock, /width:\s*100%/);
    assert.match(boardBlock, /max-width:\s*none/);
    assert.doesNotMatch(boardBlock, /max-width:\s*42rem/);
    assert.match(calendarView, /data-cal-day-nav/);
    assert.match(calendarView, /data-cal-day-today/);
    assert.match(
      css,
      /@media \(max-width: 639px\)[\s\S]*?\[data-cal-day-nav\][\s\S]*?flex-direction:\s*column/,
    );
    assert.match(
      css,
      /@media \(max-width: 639px\)[\s\S]*?\[data-cal-day-today\][\s\S]*?width:\s*100%/,
    );
  });

  it("groups Agenda by date with editorial headings and linen empty state", () => {
    assert.match(agendaView, /data-cal-agenda-groups/);
    assert.match(agendaView, /data-cal-agenda-date/);
    assert.match(agendaView, /data-cal-agenda-empty/);
    assert.match(
      css,
      /\.htc-staff \.htc-calendar-agenda \[data-cal-agenda-date\][\s\S]*?font-family:\s*var\(--font-heading\)/,
    );
    assert.match(
      css,
      /\.htc-staff \.htc-calendar-agenda \[data-cal-agenda-empty\][\s\S]*?background:\s*var\(--htc-linen\)/,
    );
    assert.match(agendaView, /Nothing upcoming in this window/);
  });

  it("uses intentional mobile Week stacking — not a shrunk 7-column grid", () => {
    assert.match(
      css,
      /@media \(min-width: 480px\) and \(max-width: 767px\)[\s\S]*?\[data-cal-week-grid\][\s\S]*?grid-template-columns:\s*repeat\(2/,
    );
    assert.match(
      css,
      /@media \(min-width: 768px\)[\s\S]*?\[data-cal-week-grid\][\s\S]*?grid-template-columns:\s*repeat\(7/,
    );
  });
});

describe("Calendar Week/Day/Agenda refinement — frozen semantics", () => {
  it("keeps locked --cal-* taxonomy hex values", () => {
    assert.match(css, /--cal-event:\s*#7B5EA0/i);
    assert.match(css, /--cal-tour:\s*#4A7EA8/i);
    assert.match(css, /--cal-meeting:\s*#D68A3E/i);
    assert.match(css, /--cal-date-hold:\s*#E8C200/i);
    assert.match(css, /--cal-blocked:\s*var\(--destructive\)/);
  });

  it("does not remap TYPE_META dots away from --cal-* tokens", () => {
    assert.match(calendarShared, /dotColor:\s*"var\(--cal-event\)"/);
    assert.match(calendarShared, /dotColor:\s*"var\(--cal-tour\)"/);
    assert.match(calendarShared, /dotColor:\s*"var\(--cal-meeting\)"/);
    assert.match(calendarShared, /dotColor:\s*"var\(--cal-date-hold\)"/);
    assert.match(calendarShared, /dotColor:\s*"var\(--cal-blocked\)"/);
  });

  it("does not change filter persistence or taxonomy/space modules", () => {
    assert.match(filtersHook, /CALENDAR_FILTER_STORAGE_KEY = "shared-taxonomy-v1"/);
    assert.match(venueScope, /VENUE_CALENDAR_TAXONOMY/);
    assert.match(spaceFilter, /calendarItemMatchesSpace/);
  });

  it("keeps print and share-availability free of Week/Day/Agenda hospitality classes", () => {
    assert.doesNotMatch(printPage, /htc-calendar-week|htc-calendar-day|htc-calendar-agenda|htc-hospitality/);
    assert.doesNotMatch(shareAvail, /htc-calendar-week|htc-calendar-day|htc-calendar-agenda|htc-linen|htc-hospitality/);
  });

  it("does not remodel Week/Day/Agenda with Month grid/schedule panel classes", () => {
    assert.doesNotMatch(weekView, /htc-calendar-month-grid|htc-calendar-schedule/);
    assert.doesNotMatch(dayView, /htc-calendar-month-grid|htc-calendar-schedule/);
    assert.doesNotMatch(agendaView, /htc-calendar-month-grid|htc-calendar-schedule/);
  });

  it("preserves navigation query params and ItemRow edit/delete hooks", () => {
    const calendarView = readFileSync(resolve("components/calendar/calendar-view.tsx"), "utf8");
    assert.match(calendarView, /view=week&weekStart=/);
    assert.match(calendarView, /view=day&date=/);
    assert.match(calendarView, /view=agenda&year=/);
    assert.match(weekView, /onEditBlock=\{onEditBlock\}/);
    assert.match(dayView, /onDeleteBlock=\{onDeleteBlock\}/);
    assert.match(agendaView, /ItemRow/);
  });
});
