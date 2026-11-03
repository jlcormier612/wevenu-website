/**
 * Phase 11B — Reports metric-family tones (category surfaces, not polarity fills).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

function read(rel: string) {
  return readFileSync(resolve(rel), "utf8");
}

describe("Phase 11B — report tone CSS", () => {
  const css = read("app/globals.css");

  it("defines KPI and metric-tile family tones without blush outstanding", () => {
    assert.match(css, /\.htc-staff \.htc-report-kpi\[data-tone="sales"\]/);
    assert.match(css, /\.htc-staff \.htc-report-kpi\[data-tone="bookings"\][\s\S]*--htc-green-mist/);
    assert.match(css, /\.htc-staff \.htc-report-kpi\[data-tone="contracted"\][\s\S]*--htc-botanical-pale/);
    assert.match(css, /\.htc-staff \.htc-report-kpi\[data-tone="collected"\][\s\S]*--htc-eucalyptus-surface/);
    assert.match(css, /\.htc-staff \.htc-report-kpi\[data-tone="outstanding"\][\s\S]*--htc-linen/);
    assert.match(css, /\.htc-staff \.htc-report-kpi\[data-tone="ops"\]/);
    assert.doesNotMatch(
      css.slice(css.indexOf("Phase 11B — Reports KPI"), css.indexOf("/* Compact metric tiles")),
      /--htc-soft-blush|--htc-soft-rose/,
    );
  });

  it("Collected uses eucalyptus-surface — stronger botanical than Contracted pale", () => {
    const collected = css.slice(
      css.indexOf('.htc-staff .htc-report-kpi[data-tone="collected"]'),
      css.indexOf('.htc-staff .htc-report-kpi[data-tone="outstanding"]'),
    );
    assert.match(collected, /background:\s*var\(--htc-eucalyptus-surface\)/);
    assert.doesNotMatch(collected, /--htc-soft-blush/);
  });

  it("defines Saved Reports linen shell", () => {
    assert.match(css, /\.htc-staff \.htc-report-saved-shell[\s\S]*--htc-linen/);
  });
});

describe("Phase 11B — ComparisonCard tone API", () => {
  const card = read("components/dashboard-system/comparison-card.tsx");

  it("exposes ComparisonTone and data-tone on the card", () => {
    assert.match(card, /export type ComparisonTone/);
    assert.match(card, /tone\?: ComparisonTone/);
    assert.match(card, /data-tone=\{tone\}/);
    assert.match(card, /htc-report-kpi/);
    assert.match(card, /comparisonDirectionClass/);
  });

  it("strengthens KPI value hierarchy and content-sized mobile cards", () => {
    assert.match(card, /htc-report-kpi-value text-\[1\.75rem\].*sm:text-3xl/);
    assert.match(card, /sm:h-full/);
    assert.match(card, /hidden min-h-\[2\.5rem\] sm:block/);
    assert.match(card, /items-start gap-3 sm:auto-rows-fr/);
  });
});

describe("Phase 11B final polish — mobile tabs", () => {
  const tabs = read("components/reporting/report-tabs.tsx");

  it("uses stronger edge fades and centers the active tab without covering chevrons", () => {
    assert.match(tabs, /edgeFadePx = 72/);
    assert.match(tabs, /w-\[4\.5rem\] bg-gradient-to-/);
    assert.match(tabs, /from-50%/);
    assert.match(tabs, /data-htc-report-tabs-fade-cap=/);
    assert.match(tabs, /pointer-events-none/);
    assert.match(tabs, /Prefer centering the active tab/);
    assert.match(tabs, /data-htc-report-tabs-edge=/);
    assert.doesNotMatch(
      tabs,
      /aria-label="Show (?:previous|more) report tabs"[\s\S]{0,240}?className="[^"]*absolute/,
    );
  });
});

describe("Phase 11B — page wiring", () => {
  const overview = read("app/(app)/reporting/page.tsx");
  const sales = read("app/(app)/reporting/sales/page.tsx");
  const bookings = read("app/(app)/reporting/bookings/page.tsx");
  const revenue = read("app/(app)/reporting/revenue/page.tsx");
  const events = read("app/(app)/reporting/events/page.tsx");
  const funnel = read("components/reporting/business-funnel.tsx");
  const saved = read("components/reporting/saved-report-list.tsx");
  const shell = read("components/reporting/reports-layout-shell.tsx");
  const tabs = read("components/reporting/report-tabs.tsx");
  const dates = read("components/reporting/date-range-control.tsx");

  it("Overview ComparisonCards use family tones", () => {
    assert.match(overview, /tone="sales"/);
    assert.match(overview, /tone="bookings"/);
    assert.match(overview, /tone="contracted"/);
    assert.match(overview, /tone="collected"/);
    assert.match(overview, /tone="outstanding"/);
  });

  it("Funnel period and cohort tiles use metric-tile tones", () => {
    assert.match(funnel, /htc-report-metric-tile/);
    assert.match(funnel, /tone: "sales"/);
    assert.match(funnel, /tone: "bookings"/);
    assert.match(funnel, /tone: "contracted"/);
    assert.match(funnel, /tone: "collected"/);
    assert.match(funnel, /tone: "outstanding"/);
    assert.match(funnel, /data-tone="sales"/);
    assert.match(funnel, /data-tone="bookings"/);
  });

  it("Sales mini-tiles map sales/bookings/money/neutral correctly", () => {
    assert.match(sales, /data-tone="sales"/);
    assert.match(sales, /data-tone="bookings"/);
    assert.match(sales, /data-tone="contracted"/);
    assert.match(sales, /data-tone="collected"/);
    assert.match(sales, /data-tone="neutral"/);
  });

  it("Bookings, Revenue, Events ComparisonCards use correct tones", () => {
    assert.match(bookings, /tone="bookings"/);
    assert.match(bookings, /tone="contracted"/);
    assert.match(revenue, /tone="contracted"/);
    assert.match(revenue, /tone="collected"/);
    assert.match(revenue, /tone="outstanding"/);
    assert.match(events, /tone="ops"/);
  });

  it("Saved Reports uses linen shell; Phase 10 chrome files untouched in structure", () => {
    assert.match(saved, /htc-report-saved-shell/);
    assert.match(shell, /htc-hospitality-intro-accent/);
    assert.match(dates, /htc-hospitality-filter/);
    assert.match(tabs, /ReportTabs|report-tabs|data-htc-report/i);
  });

  it("does not alter polarity wiring for Outstanding (still up-bad text)", () => {
    assert.match(overview, /Outstanding[\s\S]*?polarity="up-bad"/);
    assert.match(revenue, /Outstanding Balance[\s\S]*?polarity="up-bad"/);
  });
});
