/**
 * Single coordinator email contract for tour booking:
 * preference-gated `tour_scheduled` queue only (no immediate side-effect email).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import { buildVenueNotificationEmail } from "@/lib/notifications/venue-notification-email";

const ORIGIN = "https://app.sandbox.hellotocheers.com";

describe("tour coordinator single-email contract", () => {
  it("immediate side-effect no longer sends a coordinator email", () => {
    const sides = readFileSync(resolve("lib/tours/booked-side-effects.ts"), "utf8");
    const book = readFileSync(resolve("app/api/tours/book/route.ts"), "utf8");
    assert.match(book, /runTourBookedSideEffects/);
    assert.match(sides, /scheduleTourReminders/);
    assert.match(sides, /trackTourBooked/);
    assert.doesNotMatch(sides, /sendCoordinatorNotification/);
    assert.doesNotMatch(sides, /New tour booked —/);
    // Protection alert remains a separate ops email (not a booking success path).
    assert.match(sides, /buildTourProtectionAlertEmail/);
  });

  it("queue path creates in-app tour_scheduled and emails only when pref allows", () => {
    const sql = readFileSync(
      resolve("supabase/migrations/20261407100000_customer_action_notification_preferences.sql"),
      "utf8",
    );
    const createFn = sql.slice(sql.indexOf("create or replace function public.create_venue_notification"));
    const triggerFn = sql.slice(sql.indexOf("create or replace function public._trigger_tour_scheduled_notification"));

    assert.match(triggerFn, /after insert on public\.tour_appointments/);
    assert.match(triggerFn, /'tour_scheduled'/);
    assert.match(triggerFn, /New tour scheduled —/);
    assert.match(triggerFn, /create_venue_notification/);

    assert.match(createFn, /when 'tour_scheduled'\s+then pref_tour_scheduled/);
    assert.match(createFn, /if not v_enabled then return/);
    assert.match(createFn, /needs_email/);
  });

  it("processVenueNotificationEmails is idempotent after emailed_at is set", () => {
    const obligation = readFileSync(resolve("lib/notifications/obligation-engine.ts"), "utf8");
    const fn = obligation.slice(obligation.indexOf("export async function processVenueNotificationEmails"));
    assert.match(fn, /\.eq\("needs_email", true\)/);
    assert.match(fn, /\.is\("emailed_at", null\)/);
    assert.match(fn, /emailed_at: new Date\(\)\.toISOString\(\)/);
    assert.match(fn, /buildVenueNotificationEmail/);
    assert.match(fn, /recipient_role: "coordinator"/);
    // Failure leaves emailed_at null for retry; success stamps it so retries skip.
    assert.match(fn, /Left with emailed_at still null/);
  });

  it("queued email preserves branding, lead link, and booking details", () => {
    const email = buildVenueNotificationEmail({
      title: "New tour scheduled — Nicole Bethune",
      body: "Oct 15, 2026 at 4:00 PM · 60 min · wedding",
      link: "/leads/55555555-5555-5555-5555-555555555555",
      appOrigin: ORIGIN,
    });
    assert.equal(email.subject, "New tour scheduled — Nicole Bethune");
    assert.equal(email.ctaLabel, "View Nicole's lead");
    assert.match(email.html, /hello-to-cheers-logo-primary-transparent/);
    assert.match(email.html, /Oct 15, 2026 at 4:00 PM/);
    assert.match(email.text, /View Nicole's lead/);
    assert.match(email.text, /\/leads\/55555555-5555-5555-5555-555555555555/);
  });

  it("client-facing tour scheduled send path remains in tours/service", () => {
    const service = readFileSync(resolve("lib/tours/service.ts"), "utf8");
    assert.match(service, /sendTourScheduled/);
    assert.doesNotMatch(
      readFileSync(resolve("lib/tours/booked-side-effects.ts"), "utf8"),
      /sendTourScheduled/,
    );
  });
});
