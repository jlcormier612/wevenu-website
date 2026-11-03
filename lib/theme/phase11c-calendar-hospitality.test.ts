/**
 * Phase 11C — Calendar hospitality chrome (visual only; --cal-* frozen).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

function read(rel: string) {
  return readFileSync(resolve(rel), "utf8");
}

const css = read("app/globals.css");
const pageClient = read("components/calendar/calendar-page-client.tsx");
const calendarView = read("components/calendar/calendar-view.tsx");
const weekView = read("components/calendar/week-view.tsx");
const dayView = read("components/calendar/day-view.tsx");
const agendaView = read("components/calendar/agenda-view.tsx");
const printPage = read("app/(app)/calendar/print/page.tsx");

describe("Phase 11C — Calendar intro and guidance", () => {
  it("uses eucalyptus botanical-accent intro with existing actions", () => {
    assert.match(pageClient, /htc-hospitality-intro htc-hospitality-intro-accent/);
    assert.match(pageClient, /data-cal-intro=/);
    assert.match(pageClient, /title="Calendar"/);
    assert.match(pageClient, /Add Schedule Item/);
    assert.match(pageClient, /Print \/ Export/);
    assert.doesNotMatch(pageClient, /htc-hospitality-heading/);
  });

  it("wraps availability help in calm-blue guidance — not taxonomy", () => {
    assert.match(pageClient, /htc-calendar-guidance/);
    assert.match(css, /\.htc-staff \.htc-calendar-guidance[\s\S]*?background:\s*var\(--htc-calm-blue\)/);
    assert.doesNotMatch(
      css.slice(css.indexOf(".htc-staff .htc-calendar-guidance"), css.indexOf(".htc-staff .htc-calendar-view-switcher")),
      /--cal-event|--cal-tour|--htc-soft-blush/,
    );
  });
});

describe("Phase 11C — linen toolbars across views", () => {
  it("defines linen calendar toolbar shell", () => {
    assert.match(css, /\.htc-staff \.htc-calendar-toolbar[\s\S]*?background:\s*var\(--htc-linen\)/);
    assert.match(calendarView, /htc-calendar-toolbar/);
    assert.match(calendarView, /data-cal-toolbar-row="views"/);
    assert.match(calendarView, /data-cal-toolbar-row="date"/);
  });

  it("keeps a single shared linen toolbar with date nav for all four views", () => {
    assert.match(calendarView, /data-cal-toolbar-row="views"/);
    assert.match(calendarView, /data-cal-toolbar-row="date"/);
    assert.match(calendarView, /navigateWeek|Previous week/);
    assert.match(calendarView, /navigateDay|Previous day/);
    assert.match(calendarView, /view === "agenda"/);
    assert.doesNotMatch(weekView, /htc-calendar-toolbar|Previous week/);
    assert.doesNotMatch(dayView, /htc-calendar-toolbar|Previous day/);
    assert.doesNotMatch(agendaView, /htc-calendar-toolbar|Previous month/);
  });

  it("desktop toolbar places views left and date right in one linen shell", () => {
    assert.match(
      css,
      /@media \(min-width: 768px\)[\s\S]*?\.htc-calendar-toolbar[\s\S]*?flex-direction:\s*row/,
    );
    assert.match(css, /data-cal-toolbar-row="date"\][\s\S]*?margin-left:\s*auto/);
  });

  it("keeps Calendar intro actions on one row from 375px", () => {
    assert.match(pageClient, /data-cal-intro-actions=/);
    assert.match(pageClient, /flex-nowrap/);
    assert.match(css, /\[data-cal-intro-actions\][\s\S]*?flex-wrap:\s*nowrap/);
  });

  it("keeps linen filters without remapping --cal-*", () => {
    assert.match(css, /\.htc-staff \.htc-calendar-filters[\s\S]*?background:\s*var\(--htc-linen\)/);
    assert.match(css, /--cal-event:\s*#7B5EA0/i);
    assert.match(css, /--cal-tour:\s*#4A7EA8/i);
    assert.match(css, /--cal-meeting:\s*#D68A3E/i);
    assert.match(css, /--cal-date-hold:\s*#E8C200/i);
  });
});

describe("Phase 11C — legend dedupe and print isolation", () => {
  it("does not render a duplicate taxonomy legend beside FilterBar", () => {
    assert.doesNotMatch(calendarView, /htc-calendar-legend|data-cal-legend/);
    assert.match(calendarView, /FilterBar/);
  });

  it("does not pull Phase 11C chrome into print route", () => {
    assert.doesNotMatch(printPage, /htc-calendar-toolbar|htc-hospitality-intro|htc-calendar-guidance/);
  });
});
