/**
 * Workstream 2A — Calendar Month visual refinement.
 * Presentation only; frozen --cal-* taxonomy; no filter/availability logic changes.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const css = readFileSync(resolve("app/globals.css"), "utf8");
const pageClient = readFileSync(resolve("components/calendar/calendar-page-client.tsx"), "utf8");
const calendarView = readFileSync(resolve("components/calendar/calendar-view.tsx"), "utf8");
const calendarShared = readFileSync(resolve("components/calendar/calendar-shared.tsx"), "utf8");
const filtersHook = readFileSync(resolve("components/calendar/use-calendar-filters.ts"), "utf8");
const venueScope = readFileSync(resolve("lib/calendar/venue-calendar-scope.ts"), "utf8");
const spaceFilter = readFileSync(resolve("lib/calendar/space-filter.ts"), "utf8");
const printPage = readFileSync(resolve("app/(app)/calendar/print/page.tsx"), "utf8");
const shareAvail = readFileSync(resolve("components/calendar/share-availability.tsx"), "utf8");
const weekView = readFileSync(resolve("components/calendar/week-view.tsx"), "utf8");
const dayView = readFileSync(resolve("components/calendar/day-view.tsx"), "utf8");
const agendaView = readFileSync(resolve("components/calendar/agenda-view.tsx"), "utf8");

describe("Calendar Month refinement — hospitality chrome", () => {
  it("opts Calendar page into scoped workspace + white hospitality heading", () => {
    assert.match(pageClient, /htc-calendar-workspace/);
    assert.match(pageClient, /htc-hospitality-heading/);
    assert.match(pageClient, /htc-hospitality-intro-accent/);
    assert.match(pageClient, /Add Schedule Item/);
    assert.match(pageClient, /Print \/ Export/);
  });

  it("uses Calendar-scoped view switcher with botanical active state", () => {
    assert.match(calendarView, /htc-calendar-view-switcher/);
    assert.match(calendarView, /data-cal-view/);
    assert.match(css, /\.htc-staff \.htc-calendar-view-switcher \[data-cal-view\]\[data-active="true"\][\s\S]*?background:\s*var\(--primary\)/);
  });

  it("gives Month grid white cells, eucalyptus selected, botanical Today", () => {
    assert.match(calendarView, /htc-calendar-month-grid/);
    assert.match(calendarView, /data-cal-day-cell/);
    assert.match(calendarView, /data-cal-day-num/);
    assert.match(css, /\.htc-staff \.htc-calendar-month-grid \[data-cal-day-cell\][\s\S]*?background:\s*var\(--card\)/);
    assert.match(
      css,
      /\[data-cal-day-cell\]\[data-selected="true"\][\s\S]*?background:\s*var\(--htc-eucalyptus-surface\)/,
    );
    assert.match(
      css,
      /\[data-cal-day-num\]\[data-today="true"\][\s\S]*?background:\s*var\(--primary\)/,
    );
  });

  it("keeps non-Today selected date on exact eucalyptus (no blush/OKLCH drift)", () => {
    const selectedBlock = css.slice(
      css.indexOf('.htc-staff .htc-calendar-month-grid [data-cal-day-cell][data-selected="true"]'),
      css.indexOf(".htc-staff .htc-calendar-month-grid [data-cal-day-num]"),
    );
    assert.match(selectedBlock, /background:\s*var\(--htc-eucalyptus-surface\)/);
    assert.match(selectedBlock, /box-shadow:\s*inset 0 0 0 1px var\(--htc-eucalyptus\)/);
    assert.doesNotMatch(selectedBlock, /oklch|htc-soft-blush|htc-soft-rose|htc-blush|#f7e9eb|#e8c5c8/i);
    assert.match(css, /--htc-eucalyptus-surface:\s*#dce8e0/i);
  });

  it("uses exact linen for outside-month cells — never blush", () => {
    assert.match(
      css,
      /\.htc-staff \.htc-calendar-month-grid \[data-cal-day-outside\] \{\s*background:\s*var\(--htc-linen\);/,
    );
    assert.doesNotMatch(
      css,
      /\[data-cal-day-outside\][^{]*\{[^}]*background:[^;]*(?:htc-soft-blush|htc-soft-rose|--htc-blush|#f7e9eb|#e8c5c8)/i,
    );
  });

  it("uses linen Schedule companion panel (Month only)", () => {
    assert.match(calendarView, /htc-calendar-schedule/);
    assert.match(calendarView, /data-cal-schedule-panel/);
    assert.match(css, /\.htc-staff \.htc-calendar-schedule[\s\S]*?background:\s*var\(--htc-linen\)/);
    assert.match(css, /--htc-linen:\s*#f3f0e9/i);
  });

  it("Phase 11C — taxonomy legend removed; interactive FilterBar carries category colors", () => {
    assert.doesNotMatch(calendarView, /htc-calendar-legend|data-cal-legend|function Legend/);
    assert.match(calendarView, /FilterBar/);
    assert.match(calendarShared, /htc-calendar-filters/);
    assert.match(calendarShared, /data-taxonomy-chip/);
    assert.match(
      css,
      /\.htc-staff \.htc-calendar-filters[\s\S]*?background:\s*var\(--htc-linen\)/,
    );
    assert.match(
      css,
      /\[data-taxonomy-chip\]\[data-active="true"\][\s\S]*?background:\s*var\(--htc-eucalyptus-surface\)/,
    );
    assert.match(
      css,
      /\[data-taxonomy-chip\]\[data-active="false"\][\s\S]*?opacity:\s*1/,
    );
  });

  it("keeps month nav arrows with month/year on one nowrap row", () => {
    assert.match(css, /\.htc-staff \.htc-calendar-month-nav-group \{[\s\S]*?flex-wrap:\s*nowrap/);
    assert.match(css, /\[data-testid="month-year-picker"\][\s\S]*?flex-wrap:\s*nowrap/);
  });

  it("tightens desktop filter padding while preserving mobile room", () => {
    const filtersStart = css.indexOf(".htc-staff .htc-calendar-filters {");
    const filtersBlock = css.slice(filtersStart, filtersStart + 450);
    assert.match(filtersBlock, /padding:\s*0\.5rem 0\.75rem/);
    assert.match(css, /@media \(max-width: 639px\)[\s\S]*?\.htc-calendar-filters[\s\S]*?padding:\s*0\.75rem 0\.9rem/);
  });
});

describe("Calendar Month refinement — frozen semantics", () => {
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

  it("does not change filter persistence or taxonomy scope modules", () => {
    assert.match(filtersHook, /CALENDAR_FILTER_STORAGE_KEY = "shared-taxonomy-v1"/);
    assert.match(venueScope, /VENUE_CALENDAR_TAXONOMY/);
    assert.match(spaceFilter, /calendarItemMatchesSpace/);
  });

  it("keeps print and share-card components free of Calendar hospitality classes", () => {
    assert.doesNotMatch(printPage, /htc-calendar-schedule|htc-calendar-month-grid|htc-hospitality/);
    assert.doesNotMatch(shareAvail, /htc-calendar-schedule|htc-linen|htc-hospitality/);
  });

  it("does not remodel Week/Day/Agenda layouts with Month grid/schedule classes", () => {
    assert.doesNotMatch(weekView, /htc-calendar-month-grid|htc-calendar-schedule/);
    assert.doesNotMatch(dayView, /htc-calendar-month-grid|htc-calendar-schedule/);
    assert.doesNotMatch(agendaView, /htc-calendar-month-grid|htc-calendar-schedule/);
  });
});
