/**
 * Workstream 2D-A — Tours main workspace hospitality presentation.
 * Presentation-only: lifecycle/status model and Calendar --cal-tour stay locked.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const css = readFileSync(resolve("app/globals.css"), "utf8");
const page = readFileSync(resolve("app/(app)/tours/page.tsx"), "utf8");
const list = readFileSync(resolve("components/tours/tour-list.tsx"), "utf8");
const listOrder = readFileSync(resolve("lib/tours/list-order.ts"), "utf8");
const service = readFileSync(resolve("lib/tours/service.ts"), "utf8");

describe("2D-A Tours main workspace hospitality", () => {
  it("opts Tours page into hospitality page + heading chrome", () => {
    assert.match(page, /htc-hospitality-page/);
    assert.match(page, /htc-hospitality-heading/);
    assert.match(page, /htc-tours-workspace/);
  });

  it("renders Upcoming, Past, Cancelled, and Archived sections", () => {
    assert.match(page, /data-tours-section="upcoming"/);
    assert.match(page, /data-tours-section="past"/);
    assert.match(page, /data-tours-section="cancelled"/);
    assert.match(page, /TourArchivedSection|data-tours-section="archived-empty"/);
  });

  it("keeps Cancelled distinct from Archived in copy and partition helpers", () => {
    assert.match(page, /Cancelled is not the same as Archived/);
    assert.match(listOrder, /isCancelledTourAppointment/);
    assert.match(listOrder, /listCancelledTourAppointments/);
    assert.match(listOrder, /const cancelled = listCancelledTourAppointments\(appointments\)/);
    assert.match(listOrder, /a\.status === "cancelled"/);
    assert.doesNotMatch(listOrder, /is_archived.*cancelled.*status/);
  });

  it("loads cancelled appointments without changing status model", () => {
    const fn = service.slice(service.indexOf("export async function getTourAppointments"));
    const body = fn.slice(0, fn.indexOf("export async function getTourAppointmentsForLead"));
    assert.match(body, /\.eq\("status", "cancelled"\)/);
    assert.match(body, /\.eq\("is_archived", false\)/);
    assert.doesNotMatch(body, /status.*archived|new status/);
  });

  it("uses plain outcome labels without emoji decoration", () => {
    assert.match(list, /interested:\s*"Interested"/);
    assert.match(list, /considering:\s*"Considering"/);
    assert.match(list, /not_a_fit:\s*"Not a fit"/);
    assert.match(list, /booked:\s*"Booked"/);
    assert.doesNotMatch(list, /💚|🤔|❌|🎉/);
  });

  it("styles lifecycle badges with hospitality tokens (not Calendar tour blue)", () => {
    assert.match(css, /\.htc-tours-status-badge\[data-tours-status-badge="scheduled"\]/);
    assert.match(css, /\.htc-tours-status-badge\[data-tours-status-badge="confirmed"\]/);
    assert.match(css, /\.htc-tours-status-badge\[data-tours-status-badge="completed"\]/);
    assert.match(css, /\.htc-tours-status-badge\[data-tours-status-badge="cancelled"\]/);
    assert.match(css, /\.htc-tours-status-badge\[data-tours-status-badge="no_show"\]/);
    assert.match(css, /--htc-linen/);
    assert.match(css, /--htc-eucalyptus-surface/);
    assert.match(css, /--htc-soft-blush/);
    assert.match(css, /--htc-botanical/);
    // Calendar taxonomy blue must remain defined and not be used as Tours status chrome
    assert.match(css, /--cal-tour:\s*#4A7EA8/i);
    const toursRules = css.slice(
      css.indexOf(".htc-staff .htc-tours-workspace [data-tours-section]"),
      css.indexOf(".dark .htc-staff .htc-calendar-share-card"),
    );
    assert.doesNotMatch(toursRules, /var\(--cal-tour\)|#4A7EA8/i);
  });

  it("keeps confirmation actions distinct from ordinary status select", () => {
    assert.match(list, /htc-tours-confirm-actions/);
    assert.match(list, /Mark as Confirmed/);
    assert.match(list, /Send Confirmation Request/);
    assert.match(list, /htc-tours-status-select/);
    assert.match(list, /Confirmed is never a free-pick option/);
  });

  it("uses distinct section header surfaces from approved tokens", () => {
    assert.match(css, /\[data-tours-section="upcoming"\] \[data-tours-section-header\][\s\S]*?--htc-eucalyptus-surface/);
    assert.match(css, /\[data-tours-section="past"\] \[data-tours-section-header\][\s\S]*?--htc-botanical-pale/);
    assert.match(css, /\[data-tours-section="cancelled"\] \[data-tours-section-header\][\s\S]*?--htc-soft-blush/);
    assert.match(css, /\.htc-tours-archived[\s\S]*?--htc-linen/);
  });

  it("describes Upcoming without implying every tour awaits confirmation", () => {
    assert.match(page, /Tours still ahead — scheduled or confirmed/);
    assert.doesNotMatch(page, /awaiting confirmation or completion/);
  });

  it("hides editable status select for completed and cancelled terminal rows", () => {
    assert.match(list, /showStatusSelect/);
    assert.match(list, /appt\.status === "scheduled" \|\| appt\.status === "confirmed" \|\| appt\.status === "no_show"/);
    assert.match(list, /terminal for this workspace/);
    assert.match(list, /no_show: keep Select for staff corrections/);
  });

  it("mobile confirm buttons target 48px height and allow label wrap without ellipsis", () => {
    const mobile = css.slice(css.indexOf("/* Mobile: denser action band"));
    assert.match(mobile, /min-height:\s*3rem/);
    assert.match(mobile, /white-space:\s*normal/);
    assert.match(mobile, /overflow:\s*visible/);
    assert.doesNotMatch(mobile, /text-overflow:\s*ellipsis/);
    assert.doesNotMatch(mobile, /white-space:\s*nowrap/);
  });

  it("does not introduce a tours detail route", () => {
    assert.doesNotMatch(page, /\/tours\/\[/);
    assert.doesNotMatch(list, /href=\{`\/tours\/\$\{/);
  });
});
