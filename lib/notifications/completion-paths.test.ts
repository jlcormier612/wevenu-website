/**
 * Completion notifications stay in the notification system — not Automations.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

describe("verified completion notification paths", () => {
  it("contract fully signed notifies via create_venue_notification", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/20261355000000_contracts_signing_integrity.sql"),
      "utf8",
    );
    assert.match(sql, /contract_fully_executed|contract_signed/);
    assert.match(sql, /create_venue_notification/);
  });

  it("questionnaire submit notifies questionnaire_submitted", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/20261269000000_questionnaire_family.sql"),
      "utf8",
    );
    assert.match(sql, /'questionnaire_submitted'/);
    assert.match(sql, /create_venue_notification/);
  });

  it("guest count submit notifies final_guest_count_submitted", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/20261297000000_notification_preferences_email_correction.sql"),
      "utf8",
    );
    assert.match(sql, /final_guest_count_submitted/);
    assert.match(sql, /create_venue_notification/);
  });

  it("Stripe payment path notifies payment_received", () => {
    const src = readFileSync(join(process.cwd(), "lib/stripe/notify.ts"), "utf8");
    assert.match(src, /p_type: "payment_received"/);
  });

  it("Automations enrollment does not replace notification preferences", () => {
    const enroll = readFileSync(
      join(process.cwd(), "lib/message-sequences/process-platform-enrollments.ts"),
      "utf8",
    );
    assert.doesNotMatch(enroll, /create_venue_notification/);
  });
});
