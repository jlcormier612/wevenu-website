/**
 * New-lead trigger must emit display labels (Wedding), not raw keys (wedding).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import {
  presentVenueNotificationDetailBody,
} from "@/lib/notifications/venue-notification-email";

describe("new lead notification event-type label", () => {
  it("migration uses event_type_display_label in the new-lead trigger body", () => {
    const sql = readFileSync(
      resolve("supabase/migrations/20261418800000_new_lead_notification_event_type_label.sql"),
      "utf8",
    );
    assert.match(sql, /create or replace function public\.event_type_display_label/);
    assert.match(sql, /when 'wedding' then 'Wedding'/);
    assert.match(sql, /_trigger_new_lead_notification/);
    assert.match(sql, /event_type_display_label\(NEW\.event_type\)/);
    assert.doesNotMatch(sql, /coalesce\(NEW\.event_type, 'Event inquiry'\)\s*\|\|/);
  });

  it("email presentation capitalizes a leading raw event-type summary token", () => {
    assert.equal(
      presentVenueNotificationDetailBody("wedding · May 09, 2027"),
      "Wedding · May 09, 2027",
    );
    assert.equal(
      presentVenueNotificationDetailBody("corporate · Jun 01, 2028"),
      "Corporate Event · Jun 01, 2028",
    );
    assert.equal(
      presentVenueNotificationDetailBody("Event type: Wedding\nName: Alice"),
      "Event type: Wedding\nName: Alice",
    );
  });
});
