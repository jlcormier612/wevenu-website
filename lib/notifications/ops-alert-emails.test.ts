import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import { HTC_EMAIL_CTA_BACKGROUND } from "@/lib/email/htc-cta";
import { buildSavedReportReadyEmail } from "@/lib/saved-reports/schedule-engine";
import { buildTourProtectionAlertEmail } from "@/lib/tours/booked-side-effects";

const ORIGIN = "https://app.sandbox.hellotocheers.com";
const LEAD_ID = "44444444-4444-4444-4444-444444444444";

function visible(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

describe("Group B ops alert emails", () => {
  it("D4 tour protection uses HTC shell with View tours + View this lead CTAs", () => {
    const email = buildTourProtectionAlertEmail({
      venueName: "Jen's Fancy Venue",
      contactName: "Nicole Bethune",
      contactEmail: "nicole@example.com",
      slotStart: "2026-10-15T20:00:00.000Z",
      leadId: LEAD_ID,
      appOrigin: ORIGIN,
    });

    assert.equal(email.subject, "Tour protection completed — time no longer available");
    assert.match(email.text, /Payment or card-on-file succeeded/);
    assert.match(email.text, /Requested time:/);
    assert.match(email.text, /Contact: Nicole Bethune \(nicole@example\.com\)/);
    assert.match(email.text, /No tour appointment was created/);
    assert.match(email.text, /View tours\nhttps:\/\/app\.sandbox\.hellotocheers\.com\/tours/);
    assert.match(email.text, new RegExp(`View this lead\\n${ORIGIN}/leads/${LEAD_ID}`));

    assert.match(email.html, /hello-to-cheers-logo-primary-transparent/);
    assert.match(email.html, new RegExp(`background:${HTC_EMAIL_CTA_BACKGROUND}`));
    assert.match(email.html, /View tours/);
    assert.match(email.html, /View this lead/);
    assert.match(email.html, new RegExp(`href="${ORIGIN}/tours"`));
    assert.match(email.html, new RegExp(`href="${ORIGIN}/leads/${LEAD_ID}"`));
    assert.match(visible(email.html), /Payment or card-on-file succeeded/);
    assert.match(visible(email.html), /Contact: Nicole Bethune/);
    assert.doesNotMatch(visible(email.html), /https?:\/\//);
  });

  it("D4 notifyPaidUnbookedTour sends branded HTML instead of text-only raw URLs", () => {
    const src = readFileSync(resolve("lib/tours/booked-side-effects.ts"), "utf8");
    const fn = src.slice(src.indexOf("export async function notifyPaidUnbookedTour"));
    assert.match(fn, /buildTourProtectionAlertEmail/);
    assert.match(fn, /html:\s*email\.html/);
    assert.doesNotMatch(fn, /\$\{appUrl\}\/tours/);
    assert.doesNotMatch(fn, /text:\s*\[/);
  });

  it("D6 saved-report schedule uses HTC staff shell and report deep link", () => {
    const email = buildSavedReportReadyEmail({
      reportName: "Weekly sales",
      reportLabel: "Sales",
      rangeLabel: "Last 7 days",
      reportPath: "/reporting/sales",
      datePreset: "last_7_days",
      appOrigin: ORIGIN,
    });

    assert.equal(email.subject, "Weekly sales — Last 7 days");
    assert.match(email.text, /Your saved report "Weekly sales" \(Sales\) for Last 7 days is ready/);
    assert.equal(email.ctaLabel, "Open in Hello to Cheers");
    assert.equal(email.href, `${ORIGIN}/reporting/sales?range=last_7_days`);
    assert.match(email.html, /hello-to-cheers-logo-primary-transparent/);
    assert.match(email.html, new RegExp(`background:${HTC_EMAIL_CTA_BACKGROUND}`));
    assert.match(email.html, /Open in Hello to Cheers/);
    assert.match(
      email.html,
      new RegExp(`href="${ORIGIN}/reporting/sales\\?range=last_7_days"`),
    );
    assert.doesNotMatch(visible(email.html), /https?:\/\//);
  });

  it("D6 schedule engine sends the branded builder output", () => {
    const src = readFileSync(resolve("lib/saved-reports/schedule-engine.ts"), "utf8");
    assert.match(src, /buildSavedReportReadyEmail/);
    assert.match(src, /html:\s*email\.html/);
    assert.doesNotMatch(src, /<p>Your saved report/);
  });
});
