import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

/**
 * Contract: notification preferences gate optional EMAIL (needs_email), never
 * in-app row creation. Source of truth: 20261419000000_venue_notification_prefs_email_only.sql
 */
const GATE_MIGRATION = resolve(
  "supabase/migrations/20261419000000_venue_notification_prefs_email_only.sql",
);
const SETTINGS_PAGE = resolve("app/(app)/settings/communications/page.tsx");
const OBLIGATION = resolve("lib/notifications/obligation-engine.ts");
const TOUR_SERVICE = resolve("lib/tours/service.ts");
const CONFIRM_MIG = resolve("supabase/migrations/20261313000000_tour_confirmation.sql");
const CUSTOMER_ACTION_MIG = resolve(
  "supabase/migrations/20261407100000_customer_action_notification_preferences.sql",
);
const BELL = resolve("components/shell/notification-bell.tsx");
const NOTIFICATIONS_API = resolve("app/api/notifications/route.ts");

const EMAIL_OPTIONAL_TYPES = [
  "new_lead",
  "message_received",
  "questionnaire_submitted",
  "payment_failed",
  "payment_overdue",
  "payment_received",
  "contract_requires_attention",
  "contract_signed",
  "final_guest_count_submitted",
  "vendor_checked_in",
  "feedback_received",
  "referral_received",
  "tour_scheduled",
  "tour_confirmed",
  "proposal_accepted",
] as const;

describe("venue notification prefs gate email only (not in-app)", () => {
  const gate = readFileSync(GATE_MIGRATION, "utf8");
  const createFn = gate.slice(gate.indexOf("create or replace function public.create_venue_notification"));

  it("settings copy promises in-app alerts remain when optional email is off", () => {
    const page = readFileSync(SETTINGS_PAGE, "utf8");
    assert.match(
      page,
      /optional extras — your important activity and alerts will still appear in Hello to Cheers/,
    );
  });

  it("create_venue_notification always inserts; preference only sets needs_email", () => {
    assert.doesNotMatch(createFn, /if not v_email_enabled then return/);
    assert.doesNotMatch(createFn, /if not v_enabled then return/);
    assert.match(
      createFn,
      /insert into public\.venue_notifications[\s\S]*needs_email\)\s*values[\s\S]*v_email_enabled/,
    );
  });

  it("maps every optional-email notification type through the preference CASE", () => {
    for (const type of EMAIL_OPTIONAL_TYPES) {
      assert.match(createFn, new RegExp(`when '${type}'\\s+then`));
    }
  });

  it("processVenueNotificationEmails only sends rows with needs_email and no emailed_at", () => {
    const obligation = readFileSync(OBLIGATION, "utf8");
    const fn = obligation.slice(
      obligation.indexOf("export async function processVenueNotificationEmails"),
    );
    assert.match(fn, /\.eq\("needs_email", true\)/);
    assert.match(fn, /\.is\("emailed_at", null\)/);
  });

  it("tour_confirmed still fires from status transition (prospect_link RPC + manual path)", () => {
    const customerAction = readFileSync(CUSTOMER_ACTION_MIG, "utf8");
    assert.match(customerAction, /notify_tour_confirmed/);
    assert.match(customerAction, /after update of status on public\.tour_appointments/);
    const confirm = readFileSync(CONFIRM_MIG, "utf8");
    assert.match(confirm, /confirmation_source = 'prospect_link'/);
    const tourService = readFileSync(TOUR_SERVICE, "utf8");
    assert.match(tourService, /confirmation_source = "manual"/);
    assert.match(tourService, /sendTourConfirmation/);
  });

  it("customer tour confirmation email is independent of venue email prefs", () => {
    const tourService = readFileSync(TOUR_SERVICE, "utf8");
    const confirmFn = tourService.slice(
      tourService.indexOf("export async function confirmTourByToken"),
    );
    assert.match(confirmFn, /sendTourConfirmation/);
    assert.doesNotMatch(confirmFn, /pref_tour_confirmed|prefTourConfirmed|needs_email/);
  });

  it("bell API lists venue_notifications without filtering out preference-off types", () => {
    const api = readFileSync(NOTIFICATIONS_API, "utf8");
    assert.match(api, /get_venue_notifications/);
    const bell = readFileSync(BELL, "utf8");
    assert.match(bell, /tour_confirmed:\s+"Open the lead"/);
    assert.match(bell, /tour_scheduled:\s+"Open the lead"/);
  });

  it("confirm replay remains idempotent at the RPC (no second status transition)", () => {
    const confirm = readFileSync(CONFIRM_MIG, "utf8");
    const fn = confirm.slice(confirm.indexOf("create or replace function public.confirm_tour_by_token"));
    const earlyReturn = fn.indexOf("alreadyConfirmed', true");
    const statusUpdate = fn.indexOf("set status = 'confirmed'");
    assert.ok(earlyReturn > 0 && statusUpdate > earlyReturn);
  });
});
