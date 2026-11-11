/**
 * Focused coverage for venue NotificationBell clear/dismiss parity.
 * Source + migration contracts — does not mutate Sandbox or Production.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { needsSessionResolution } from "@/integrations/supabase/proxy";

const root = resolve(".");
const migration = resolve(
  "supabase/migrations/20261413100000_clear_venue_notifications.sql",
);
const clearRoute = resolve("app/api/notifications/clear/route.ts");
const readRoute = resolve("app/api/notifications/read/route.ts");
const listRoute = resolve("app/api/notifications/route.ts");
const bell = resolve("components/shell/notification-bell.tsx");
const vendorBell = resolve("components/vendor-app/vendor-notification-bell.tsx");
const coupleBell = resolve("components/portal/couple-notification-bell.tsx");
const vendorClearMigration = resolve(
  "supabase/migrations/20261188000000_vendor_notifications_clear.sql",
);
const coupleMigration = resolve(
  "supabase/migrations/20261190000000_couple_notifications.sql",
);

function read(path: string): string {
  return readFileSync(path, "utf8");
}

describe("venue clear_venue_notifications RPC", () => {
  it("clear one and clear-all are venue-scoped via current_user_venue_id", () => {
    assert.ok(existsSync(migration));
    const sql = read(migration);
    assert.match(sql, /create or replace function public\.clear_venue_notifications\(p_notification_ids uuid\[\]\)/);
    assert.match(sql, /v_venue_id := public\.current_user_venue_id\(\)/);
    assert.match(sql, /if v_venue_id is null then[\s\S]*ok', false/);
    assert.match(
      sql,
      /if array_length\(p_notification_ids, 1\) is null or array_length\(p_notification_ids, 1\) = 0 then[\s\S]*delete from public\.venue_notifications[\s\S]*where venue_id = v_venue_id/,
    );
    assert.match(
      sql,
      /delete from public\.venue_notifications[\s\S]*where id = any\(p_notification_ids\)[\s\S]*and venue_id = v_venue_id/,
    );
    // Executable body must only delete venue_notifications (comments may name siblings).
    const body = sql.slice(sql.indexOf("as $$"), sql.indexOf("$$;"));
    assert.match(body, /delete from public\.venue_notifications/);
    assert.doesNotMatch(body, /delete from public\.vendor_notifications/);
    assert.doesNotMatch(body, /delete from public\.couple_notifications/);
    assert.doesNotMatch(body, /clear_vendor_notifications/);
    assert.doesNotMatch(body, /clear_couple_notifications/);
  });

  it("other-venue ids cannot be deleted (venue_id predicate required)", () => {
    const sql = read(migration);
    const clearOne = sql.slice(
      sql.indexOf("else"),
      sql.indexOf("return jsonb_build_object('ok', true)"),
    );
    assert.match(clearOne, /venue_id = v_venue_id/);
    assert.match(clearOne, /id = any\(p_notification_ids\)/);
  });

  it("unauthenticated clear fails closed (null venue_id → ok false)", () => {
    const sql = read(migration);
    assert.match(
      sql,
      /if v_venue_id is null then\s+return jsonb_build_object\('ok', false\);/,
    );
  });
});

describe("venue notification clear API route", () => {
  it("POST /api/notifications/clear calls clear_venue_notifications only", () => {
    assert.ok(existsSync(clearRoute));
    const src = read(clearRoute);
    assert.match(src, /clear_venue_notifications/);
    assert.match(src, /p_notification_ids: ids/);
    assert.doesNotMatch(src, /clear_vendor_notifications/);
    assert.doesNotMatch(src, /clear_couple_notifications/);
    assert.doesNotMatch(src, /mark_notifications_read/);
  });

  it("read and list routes remain on venue RPCs", () => {
    const readSrc = read(readRoute);
    const listSrc = read(listRoute);
    assert.match(readSrc, /mark_notifications_read/);
    assert.match(listSrc, /get_venue_notifications/);
  });

  it("clear/read/list paths require a venue session", () => {
    assert.equal(needsSessionResolution("/api/notifications"), true);
    assert.equal(needsSessionResolution("/api/notifications/read"), true);
    assert.equal(needsSessionResolution("/api/notifications/clear"), true);
    assert.equal(needsSessionResolution("/api/notifications/process"), false);
  });
});

describe("NotificationBell clear UI + preserved read paths", () => {
  it("keeps mark-all-read and click-to-read on venue read endpoints", () => {
    const src = read(bell);
    assert.match(src, /async function markAllRead/);
    assert.match(src, /async function markOneRead/);
    assert.match(src, /\/api\/notifications\/read/);
    assert.match(src, /Mark all read/);
    assert.match(src, /body: JSON\.stringify\(\{ ids: \[\] \}\)/);
    assert.match(src, /body: JSON\.stringify\(\{ ids: \[id\] \}\)/);
  });

  it("individual clear removes the row and Clear all empties the list", () => {
    const src = read(bell);
    assert.match(src, /async function clearOne/);
    assert.match(src, /async function clearAll/);
    assert.match(src, /setNotifications\(prev => prev\.filter\(n => n\.id !== id\)\)/);
    assert.match(src, /setNotifications\(\[\]\)/);
    assert.match(src, /setUnreadCount\(0\)/);
    assert.match(src, /setUnreadCount\(prev => Math\.max\(0, prev - 1\)\)/);
    assert.match(src, /Clear all/);
    assert.match(src, /aria-label="Dismiss"/);
  });

  it("unread badge still drives from unreadCount", () => {
    const src = read(bell);
    assert.match(src, /const hasUnread = unreadCount > 0/);
    assert.match(src, /\{unreadCount > 99 \? "99\+" : unreadCount\}/);
    assert.match(src, /\{unreadCount\} new/);
  });

  it("venue bell calls ONLY venue notification endpoints", () => {
    const src = read(bell);
    assert.match(src, /fetch\("\/api\/notifications"\)/);
    assert.match(src, /fetch\("\/api\/notifications\/read"/);
    assert.match(src, /fetch\("\/api\/notifications\/clear"/);
    assert.doesNotMatch(src, /\/api\/vendor\/notifications/);
    assert.doesNotMatch(src, /\/api\/portal\/notifications/);
    assert.doesNotMatch(src, /clear_vendor_notifications/);
    assert.doesNotMatch(src, /clear_couple_notifications/);
  });

  it("footer no longer claims a 30-day expiry job", () => {
    const src = read(bell);
    assert.doesNotMatch(src, /expire after 30 days/);
    assert.match(src, /most recent/);
  });
});

describe("vendor and couple notification systems untouched", () => {
  it("vendor clear path still uses vendor RPC + endpoints", () => {
    const vendorSql = read(vendorClearMigration);
    const vendorUi = read(vendorBell);
    assert.match(vendorSql, /clear_vendor_notifications/);
    assert.match(vendorSql, /vendor_notifications/);
    assert.doesNotMatch(vendorSql, /clear_venue_notifications/);
    assert.match(vendorUi, /\/api\/vendor\/notifications\/clear/);
    assert.match(vendorUi, /\/api\/vendor\/notifications\/read/);
    assert.doesNotMatch(vendorUi, /\/api\/notifications\/clear/);
  });

  it("couple clear path still uses couple RPC + endpoints", () => {
    const coupleSql = read(coupleMigration);
    const coupleUi = read(coupleBell);
    assert.match(coupleSql, /clear_couple_notifications/);
    assert.match(coupleSql, /couple_notifications/);
    assert.doesNotMatch(coupleSql, /clear_venue_notifications/);
    assert.match(coupleUi, /\/api\/portal\/notifications\/clear/);
    assert.match(coupleUi, /\/api\/portal\/notifications\/read/);
    assert.doesNotMatch(coupleUi, /\/api\/notifications\/clear/);
  });

  it("does not edit vendor/couple clear route files in this workstream", () => {
    assert.ok(existsSync(resolve("app/api/vendor/notifications/clear/route.ts")));
    assert.ok(existsSync(resolve("app/api/portal/notifications/clear/route.ts")));
    const vendorRoute = read(resolve("app/api/vendor/notifications/clear/route.ts"));
    const portalRoute = read(resolve("app/api/portal/notifications/clear/route.ts"));
    assert.match(vendorRoute, /clearVendorNotifications/);
    assert.match(portalRoute, /clearCoupleNotifications/);
    assert.doesNotMatch(vendorRoute, /clear_venue_notifications/);
    assert.doesNotMatch(portalRoute, /clear_venue_notifications/);
  });
});
