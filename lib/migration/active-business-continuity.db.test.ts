/**
 * Smith Wedding — operational continuity (guests, vendor assignments, timeline)
 * against local Supabase via canonical commit helpers.
 */
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, it, type TestContext } from "node:test";

import { commitOperationalGuest } from "@/lib/migration/operational-guest";
import { commitEventVendorAssignmentQuietly } from "@/lib/migration/event-vendor-assignment";
import { commitOperationalTimelineEntry } from "@/lib/migration/operational-timeline";

const LOCAL_DB = process.env.HTC_LOCAL_DATABASE_URL
  ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const LOCAL_API = process.env.NEXT_PUBLIC_SUPABASE_URL
  ?? process.env.SUPABASE_URL
  ?? "http://127.0.0.1:54321";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const MIGRATIONS = [
  resolve("supabase/migrations/20261324000000_active_financial_cutover.sql"),
  resolve("supabase/migrations/20261325000000_active_commitment_portal_share.sql"),
  resolve("supabase/migrations/20261326000000_active_business_continuity.sql"),
];

function psql(sql: string): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync("psql", [LOCAL_DB, "-v", "ON_ERROR_STOP=1", "-c", sql], {
    encoding: "utf8",
    timeout: 30_000,
  });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function localReady(): boolean {
  return spawnSync("psql", [LOCAL_DB, "-c", "select 1"], { encoding: "utf8", timeout: 3000 }).status === 0;
}

function applyMigrations(): void {
  for (const file of MIGRATIONS) {
    const run = spawnSync("psql", [LOCAL_DB, "-v", "ON_ERROR_STOP=1", "-f", file], {
      encoding: "utf8",
      timeout: 30_000,
    });
    assert.equal(run.status, 0, `${file}: ${run.stderr || run.stdout}`);
  }
}

function adminClient(): SupabaseClient {
  return createClient(LOCAL_API, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

describe("Smith Wedding operational continuity (guests, vendors, timeline)", () => {
  it("imports 125 guests, 4 assignments, finalized timeline; idempotent; no notify side effects", async (t: TestContext) => {
    if (!localReady()) {
      t.skip("local Postgres is not running");
      return;
    }
    applyMigrations();
    const supabase = adminClient();

    const venueId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeb1";
    const ownerId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeb2";
    const clientId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeb3";
    const eventId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeb4";

    psql(`delete from public.venues where id = '${venueId}'; delete from auth.users where id = '${ownerId}';`);
    const setup = psql(`
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, email_change,
        email_change_token_new, recovery_token
      ) values (
        '00000000-0000-0000-0000-000000000000', '${ownerId}', 'authenticated', 'authenticated',
        'smith-continuity-owner@example.test', crypt('not-a-login', gen_salt('bf')),
        now(), '{"provider":"email","providers":["email"]}', '{}',
        now(), now(), '', '', '', ''
      );
      insert into public.venues (id, owner_user_id, name, timezone)
      values ('${venueId}', '${ownerId}', 'Smith Continuity Venue', 'America/New_York');
      insert into public.clients (id, venue_id, first_name, last_name, email, status)
      values ('${clientId}', '${venueId}', 'Alex', 'Smith', 'smith-continuity@example.com', 'confirmed');
      insert into public.events (id, venue_id, client_id, name, event_date, guest_count, status)
      values ('${eventId}', '${venueId}', '${clientId}', 'Smith Wedding', '2026-10-17', 150, 'confirmed');
    `);
    assert.equal(setup.status, 0, setup.stderr);

    // Guests — 125, then re-import must stay 125
    for (let i = 1; i <= 125; i++) {
      const r = await commitOperationalGuest(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase as any,
        venueId,
        {
          eventId,
          firstName: `Guest${i}`,
          lastName: "SmithParty",
          email: `guest${i}@smith-wedding.test`,
          household: i <= 40 ? "A" : i <= 80 ? "B" : "C",
          rsvpStatus: i % 5 === 0 ? "declined" : "attending",
          sourceId: `smith-guest-${i}`,
        },
      );
      assert.equal(r.ok, true, r.ok ? "" : r.error);
    }
    const { count: guestCount1 } = await supabase.from("couple_guests")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId).eq("venue_id", venueId);
    assert.equal(guestCount1, 125);

    for (let i = 1; i <= 125; i++) {
      const r = await commitOperationalGuest(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase as any,
        venueId,
        {
          eventId,
          firstName: `Guest${i}`,
          lastName: "SmithParty",
          email: `guest${i}@smith-wedding.test`,
          sourceId: `smith-guest-${i}`,
        },
      );
      assert.equal(r.ok, true);
      if (r.ok) assert.equal(r.alreadyExisted, true);
    }
    const { count: guestCount2 } = await supabase.from("couple_guests")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId).eq("venue_id", venueId);
    assert.equal(guestCount2, 125);

    // Vendor assignments — photographer, caterer, florist, DJ (quiet)
    const vendors = [
      { name: "Lens & Light", category: "photographer", sourceId: "smith-va-photo" },
      { name: "Plate & Pour", category: "caterer", sourceId: "smith-va-caterer" },
      { name: "Bloom House", category: "florist", sourceId: "smith-va-florist" },
      { name: "Spin City DJ", category: "dj", sourceId: "smith-va-dj" },
    ];
    const assignmentIds: string[] = [];
    for (const v of vendors) {
      const r = await commitEventVendorAssignmentQuietly(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase as any,
        venueId,
        {
          eventId,
          vendorBusinessName: v.name,
          category: v.category,
          arrivalTime: "14:00",
          sourceId: v.sourceId,
        },
      );
      assert.equal(r.ok, true, r.ok ? "" : r.error);
      if (r.ok) assignmentIds.push(r.assignmentId);
    }
    assert.equal(assignmentIds.length, 4);

    for (const v of vendors) {
      const r = await commitEventVendorAssignmentQuietly(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase as any,
        venueId,
        {
          eventId,
          vendorBusinessName: v.name,
          category: v.category,
          sourceId: v.sourceId,
        },
      );
      assert.equal(r.ok, true);
      if (r.ok) assert.equal(r.alreadyExisted, true);
    }
    const { count: assignmentCount } = await supabase.from("event_vendor_assignments")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId).eq("venue_id", venueId);
    assert.equal(assignmentCount, 4);

    // No fabricated check-in
    const { data: checkins } = await supabase.from("event_vendor_assignments")
      .select("checked_in_at, setup_complete_at")
      .eq("event_id", eventId);
    for (const row of checkins ?? []) {
      assert.equal((row as { checked_in_at: string | null }).checked_in_at, null);
      assert.equal((row as { setup_complete_at: string | null }).setup_complete_at, null);
    }

    // Quiet: strip in-app assigned_to_event alerts created by the DB trigger
    const { data: leftoverNotifs } = await supabase.from("vendor_notifications")
      .select("id")
      .in("assignment_id", assignmentIds)
      .eq("type", "assigned_to_event");
    assert.equal((leftoverNotifs ?? []).length, 0);

    // Timeline — far event (>21d from 2026-09-03) needs finalized/force
    const skipped = await commitOperationalTimelineEntry(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      venueId,
      { eventId, title: "Ceremony", entryTime: "16:00", sourceId: "tl-skip" },
    );
    assert.equal(skipped.ok, true);
    if (skipped.ok) assert.equal(skipped.skipped, true);

    const ceremony = await commitOperationalTimelineEntry(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      venueId,
      {
        eventId,
        title: "Ceremony",
        entryTime: "16:00",
        timelineFinalized: true,
        audiences: "venue,vendors",
        sourceId: "tl-ceremony",
      },
    );
    assert.equal(ceremony.ok, true);
    if (ceremony.ok) assert.ok(ceremony.entryId);

    const again = await commitOperationalTimelineEntry(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      venueId,
      {
        eventId,
        title: "Ceremony",
        entryTime: "16:00",
        timelineFinalized: true,
        sourceId: "tl-ceremony",
      },
    );
    assert.equal(again.ok, true);
    if (again.ok) assert.equal(again.alreadyExisted, true);

    const { count: timelineCount } = await supabase.from("timeline_entries")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId).eq("venue_id", venueId);
    assert.equal(timelineCount, 1);

    // Portal guests visible
    const token = "smith-continuity-portal-token-0001";
    psql(`
      delete from public.client_portal_sessions where access_token = '${token}';
      insert into public.client_portal_sessions (
        venue_id, client_id, event_id, access_token, access_level, expires_at
      ) values (
        '${venueId}', '${clientId}', '${eventId}', '${token}', 'couple', now() + interval '30 days'
      );
    `);
    const { data: portalGuests, error: guestsErr } = await supabase.rpc("get_couple_guests", { p_token: token });
    assert.ifError(guestsErr);
    const guestsArr = (portalGuests as { guests?: unknown[] })?.guests
      ?? (Array.isArray(portalGuests) ? portalGuests : null);
    if (guestsArr) {
      assert.ok(guestsArr.length >= 125, `portal guests expected >=125 got ${guestsArr.length}`);
    } else {
      // Some RPC shapes nest differently — assert raw text includes a known guest
      assert.match(JSON.stringify(portalGuests), /Guest1/);
    }

    psql(`delete from public.venues where id = '${venueId}'; delete from auth.users where id = '${ownerId}';`);
  });
});
