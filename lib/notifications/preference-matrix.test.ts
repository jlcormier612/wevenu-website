import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

/**
 * Preference → notification type matrix (venue staff optional email).
 * Source of truth: should_email_venue_notification() in
 * supabase/migrations/20261298000000_reminder_cadence_and_venue_email.sql
 * (and later preference migrations). This test locks the customer-facing
 * mapping — it does not prove live email delivery.
 */
const PREFERENCE_MATRIX: {
  prefKey: string;
  notificationType: string;
  uiLabel: string;
  channel: "email_optional" | "in_app_only_by_design";
}[] = [
  { prefKey: "pref_new_lead", notificationType: "new_lead", uiLabel: "New inquiry", channel: "email_optional" },
  { prefKey: "pref_message_received", notificationType: "message_received", uiLabel: "New message", channel: "email_optional" },
  { prefKey: "pref_client_submitted_info", notificationType: "questionnaire_submitted", uiLabel: "Client submitted important information", channel: "email_optional" },
  { prefKey: "pref_payment_failed", notificationType: "payment_failed", uiLabel: "Payment failed", channel: "email_optional" },
  { prefKey: "pref_payment_overdue", notificationType: "payment_overdue", uiLabel: "Payment overdue", channel: "email_optional" },
  { prefKey: "pref_payment_received", notificationType: "payment_received", uiLabel: "Payment received", channel: "email_optional" },
  { prefKey: "pref_contract_requires_attention", notificationType: "contract_requires_attention", uiLabel: "Contract requires attention", channel: "email_optional" },
  { prefKey: "pref_contract_signed", notificationType: "contract_signed", uiLabel: "Contract signed", channel: "email_optional" },
  { prefKey: "pref_final_guest_count_submitted", notificationType: "final_guest_count_submitted", uiLabel: "Final guest count submitted", channel: "email_optional" },
  { prefKey: "pref_vendor_checked_in", notificationType: "vendor_checked_in", uiLabel: "Vendor check-in", channel: "email_optional" },
  { prefKey: "pref_feedback_received", notificationType: "feedback_received", uiLabel: "Feedback received", channel: "email_optional" },
  { prefKey: "pref_referral_received", notificationType: "referral_received", uiLabel: "Referral received", channel: "email_optional" },
];

describe("notification preference matrix", () => {
  const sql = readFileSync(
    resolve("supabase/migrations/20261298000000_reminder_cadence_and_venue_email.sql"),
    "utf8",
  );
  const ui = readFileSync(
    resolve("components/settings/notification-preferences-section.tsx"),
    "utf8",
  );

  for (const row of PREFERENCE_MATRIX) {
    it(`${row.uiLabel}: ${row.notificationType} ↔ ${row.prefKey}`, () => {
      assert.match(sql, new RegExp(`when '${row.notificationType}'\\s+then ${row.prefKey}`));
      assert.match(ui, new RegExp(row.uiLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    });
  }

  it("keeps RSVP and routine task completion out of the focused email preference UI", () => {
    assert.doesNotMatch(ui, /prefRsvpReceived/);
    assert.doesNotMatch(ui, /prefTaskCompleted/);
    assert.match(sql, /when 'rsvp_received'\s+then pref_rsvp_received/);
    assert.match(sql, /when 'task_completed_couple'\s+then pref_task_completed/);
  });
});
