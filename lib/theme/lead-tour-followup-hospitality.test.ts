/**
 * Workstream 2D-B1 — Lead Tour & follow-up hospitality presentation.
 * Presentation-only: lifecycle, URL/token/`?o=`, and Schedule sheet (B2) stay locked.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const css = readFileSync(resolve("app/globals.css"), "utf8");
const panel = readFileSync(resolve("components/leads/tour-panel.tsx"), "utf8");
const card = readFileSync(resolve("components/leads/relationship-card.tsx"), "utf8");
const detail = readFileSync(resolve("components/leads/lead-detail.tsx"), "utf8");
const origin = readFileSync(resolve("lib/tours/origin-context.ts"), "utf8");
const publicLink = readFileSync(resolve("lib/tours/public-link.ts"), "utf8");

const leadTourCss = css.slice(
  css.indexOf("/* ─── 2D-B1: Lead Tour & follow-up"),
  css.indexOf(".dark .htc-staff .htc-calendar-share-card"),
);

describe("2D-B1 Lead Tour & follow-up hospitality", () => {
  it("opts the Tour & follow-up card into lead hospitality chrome", () => {
    assert.match(card, /htc-lead-tour-followup/);
    assert.match(card, /htc-lead-tour-followup-title/);
    assert.match(card, /font-heading/);
    assert.match(detail, /tourAppointments=\{<TourAppointmentList \/>\}/);
  });

  it("reuses 2D-A status badge tokens — not Tailwind semantic STATUS_META washes", () => {
    assert.match(panel, /htc-tours-status-badge/);
    assert.match(panel, /data-tours-status-badge=\{appt\.status\}/);
    assert.match(panel, /no_show:\s*"No Show"/);
    assert.doesNotMatch(panel, /STATUS_META/);
    assert.doesNotMatch(panel, /bg-warning\/15|bg-primary\/15|bg-destructive\/15/);
    assert.match(css, /\.htc-tours-status-badge\[data-tours-status-badge="scheduled"\]/);
    assert.match(css, /\.htc-tours-status-badge\[data-tours-status-badge="no_show"\]/);
  });

  it("keeps overdue orthogonal to lifecycle status", () => {
    assert.match(panel, /showOverdue = appt\.status === "scheduled" && isPast/);
    assert.match(panel, /htc-lead-tour-overdue/);
    assert.match(panel, /data-tour-overdue-badge/);
    assert.match(leadTourCss, /\.htc-lead-tour-overdue/);
    assert.doesNotMatch(panel, /if \(showOverdue\) return null|if \(isPast && .*hide/);
  });

  it("presents a clear action hierarchy without removing functional actions", () => {
    const rowStart = panel.indexOf("function AppointmentRow");
    const row = panel.slice(rowStart, panel.indexOf("type TourScheduleContextValue"));
    assert.match(row, /htc-lead-tour-confirm-primary/);
    assert.match(row, /Mark as Confirmed/);
    assert.match(row, /Send Confirmation Request/);
    assert.match(row, /Reschedule/);
    assert.match(row, /Completed/);
    assert.match(row, /No Show/);
    assert.match(row, /htc-lead-tour-action-destructive/);
    assert.match(row, />\s*Cancel\s*</);
    // 2D-B2: single Reschedule action — duplicate Edit entry point removed
    assert.doesNotMatch(row, /tour-appointment-edit-\$/);
    assert.match(row, /tour-appointment-reschedule-\$/);
  });

  it("presents personalized link as contextual lead action with unchanged copy handler", () => {
    assert.match(panel, /htc-lead-tour-personal-link/);
    assert.match(panel, /data-testid="lead-personalized-scheduling-link"/);
    assert.match(panel, /Personalized scheduling link/);
    assert.match(panel, /getLeadPublicTourSchedulingUrlAction/);
    assert.match(panel, /navigator\.clipboard\.writeText/);
    assert.match(panel, /data-testid="lead-copy-scheduling-link"/);
    assert.match(panel, /Copy link/);
    // Token / HMAC construction stays in domain modules — panel only consumes the action path
    assert.match(publicLink, /originToken/);
    assert.match(publicLink, /\?o=/);
    assert.match(origin, /HMAC|hmac|sign/i);
  });

  it("renders an empty appointment state without inventing scheduling capability", () => {
    assert.match(panel, /data-testid="tour-appointment-list-empty"/);
    assert.match(panel, /No tour appointment scheduled/);
    assert.match(panel, /personalized scheduling/);
  });

  it("uses hospitality tokens on lead tour surfaces — not Calendar tour blue", () => {
    assert.match(leadTourCss, /--htc-border-warm/);
    assert.match(leadTourCss, /--htc-botanical/);
    assert.match(leadTourCss, /--htc-linen/);
    assert.match(leadTourCss, /--htc-soft-blush/);
    assert.doesNotMatch(leadTourCss, /var\(--cal-tour\)|#4A7EA8/i);
    assert.match(css, /--cal-tour:\s*#4A7EA8/i);
  });

  it("scopes experimental pale-blue personal-link surface without changing shared blush tokens", () => {
    const personal = leadTourCss.slice(
      leadTourCss.indexOf(".htc-staff .htc-lead-tour-personal-link {"),
      leadTourCss.indexOf(".htc-staff .htc-lead-tour-empty {"),
    );
    assert.match(personal, /background:\s*#eaf1f7/i);
    assert.match(personal, /border:\s*1px solid #d5e1eb/i);
    assert.match(personal, /border-left:\s*3px solid #dfe9f1/i);
    assert.doesNotMatch(personal, /--htc-soft-blush|--htc-linen|#f7e9eb/i);
    // Shared blush token definition and other blush consumers unchanged
    assert.match(css, /--htc-soft-blush:\s*#f7e9eb/i);
    assert.match(css, /\.htc-tours-status-badge\[data-tours-status-badge="no_show"\][\s\S]*?background:\s*var\(--htc-soft-blush\)/);
    assert.match(leadTourCss, /\.htc-lead-tour-overdue[\s\S]*?--htc-soft-blush/);
  });

  it("targets mobile confirm/touch heights consistent with 2D-A correction", () => {
    assert.match(leadTourCss, /min-height:\s*3rem/);
    assert.match(leadTourCss, /min-height:\s*2\.75rem/);
    assert.match(leadTourCss, /@media \(max-width: 639px\)/);
  });

  it("does not alter Schedule sheet / SlotPickerSheet (B2 out of scope)", () => {
    assert.match(panel, /function SlotPickerSheet|SlotPickerSheet/);
    assert.match(panel, /scheduleTourAction|rescheduleTourAction/);
  });
});
