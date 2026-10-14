/**
 * Documents the two coordinator notify paths for one tour booking.
 * Product has not approved collapsing them — do not suppress either path here.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

describe("tour coordinator dual notification contract", () => {
  it("immediate side-effect still sends New tour booked after booking", () => {
    const sides = readFileSync(resolve("lib/tours/booked-side-effects.ts"), "utf8");
    const book = readFileSync(resolve("app/api/tours/book/route.ts"), "utf8");
    assert.match(book, /runTourBookedSideEffects/);
    assert.match(sides, /sendCoordinatorNotification/);
    assert.match(sides, /New tour booked —/);
    assert.match(sides, /buildVenueNotificationEmail/);
    assert.match(sides, /html:\s*email\.html/);
  });

  it("preference-gated tour_scheduled path remains a separate queue email", () => {
    const sql = readFileSync(
      resolve("supabase/migrations/20261407100000_customer_action_notification_preferences.sql"),
      "utf8",
    );
    const obligation = readFileSync(resolve("lib/notifications/obligation-engine.ts"), "utf8");
    assert.match(sql, /pref_tour_scheduled/);
    assert.match(sql, /when 'tour_scheduled'\s+then pref_tour_scheduled/);
    assert.match(sql, /New tour scheduled —/);
    assert.match(obligation, /processVenueNotificationEmails/);
    assert.match(obligation, /buildVenueNotificationEmail/);
    assert.match(obligation, /recipient_role: "coordinator"/);
  });

  it("the two subjects are distinct — collapsing requires an explicit product decision", () => {
    const sides = readFileSync(resolve("lib/tours/booked-side-effects.ts"), "utf8");
    const sql = readFileSync(
      resolve("supabase/migrations/20261407100000_customer_action_notification_preferences.sql"),
      "utf8",
    );
    assert.match(sides, /New tour booked —/);
    assert.match(sql, /New tour scheduled —/);
    assert.notEqual("New tour booked", "New tour scheduled");
    // Side-effect is not preference-gated; queue path is.
    assert.doesNotMatch(sides, /pref_tour_scheduled/);
    assert.match(sql, /pref_tour_scheduled/);
  });
});
