/**
 * Lead delete with a legitimate booked client and downstream records.
 * Verifies financials/workspace survive and Booking history cannot resurrect.
 */
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { describe, it, type TestContext } from "node:test";

import { listLifecycleBookingsInPeriod } from "@/lib/lifecycle-bookings/service";
import { withLocalDbSchemaLock } from "@/lib/test/local-db-schema-lock";

const LOCAL_DB = process.env.HTC_LOCAL_DATABASE_URL
  ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const LOCAL_API = process.env.NEXT_PUBLIC_SUPABASE_URL
  ?? process.env.SUPABASE_URL
  ?? "http://127.0.0.1:54321";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const venueId = "dddddddd-bbbb-cccc-dddd-eeeeeeeeee01";
const ownerId = "dddddddd-bbbb-cccc-dddd-eeeeeeeeee02";
const leadId = "dddddddd-bbbb-cccc-dddd-eeeeeeeeee03";
const clientId = "dddddddd-bbbb-cccc-dddd-eeeeeeeeee04";
const eventId = "dddddddd-bbbb-cccc-dddd-eeeeeeeeee05";
const relId = "dddddddd-bbbb-cccc-dddd-eeeeeeeeee06";
const contractId = "dddddddd-bbbb-cccc-dddd-eeeeeeeeee08";
const scheduleId = "dddddddd-bbbb-cccc-dddd-eeeeeeeeee09";
const paymentId = "dddddddd-bbbb-cccc-dddd-eeeeeeeeee10";
const docId = "dddddddd-bbbb-cccc-dddd-eeeeeeeeee11";
const tourId = "dddddddd-bbbb-cccc-dddd-eeeeeeeeee12";
const threadId = "dddddddd-bbbb-cccc-dddd-eeeeeeeeee13";

function psql(sql: string): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync("psql", [LOCAL_DB, "-v", "ON_ERROR_STOP=1", "-c", sql], {
    encoding: "utf8",
    timeout: 30_000,
  });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function localReady(): boolean {
  const probe = spawnSync("psql", [LOCAL_DB, "-c", "select 1"], { encoding: "utf8", timeout: 3000 });
  return probe.status === 0;
}

function adminClient(): SupabaseClient {
  return createClient(LOCAL_API, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function cleanup(): void {
  psql(`
    delete from public.conversation_messages where venue_id = '${venueId}';
    delete from public.conversations where venue_id = '${venueId}';
    delete from public.documents where venue_id = '${venueId}';
    delete from public.payment_line_items where venue_id = '${venueId}';
    delete from public.payment_schedules where venue_id = '${venueId}';
    delete from public.contracts where venue_id = '${venueId}';
    delete from public.tour_appointments where venue_id = '${venueId}';
    delete from public.message_threads where venue_id = '${venueId}';
    delete from public.lifecycle_booking_events where venue_id = '${venueId}';
    delete from public.lead_notes where venue_id = '${venueId}';
    delete from public.lead_tasks where venue_id = '${venueId}';
    delete from public.events where venue_id = '${venueId}';
    delete from public.clients where venue_id = '${venueId}';
    delete from public.leads where venue_id = '${venueId}';
    delete from public.venue_customer_relationships where venue_id = '${venueId}';
  `);
}

describe("Delete lead with downstream records", () => {
  it("keeps client/financials/conversation and removes Booking history", async (t: TestContext) => {
    if (!localReady()) {
      t.skip("local Postgres is not running");
      return;
    }

    await withLocalDbSchemaLock(async () => {
      cleanup();
      const setup = psql(`
        insert into auth.users (
          instance_id, id, aud, role, email, encrypted_password,
          email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
          created_at, updated_at, confirmation_token, email_change,
          email_change_token_new, recovery_token
        ) values (
          '00000000-0000-0000-0000-000000000000', '${ownerId}', 'authenticated', 'authenticated',
          'delete-verify-owner@example.test', crypt('not-a-login', gen_salt('bf')),
          now(), '{"provider":"email","providers":["email"]}', '{}',
          now(), now(), '', '', '', ''
        ) on conflict (id) do nothing;
        insert into public.venues (id, owner_user_id, name, timezone)
        values ('${venueId}', '${ownerId}', 'Delete Verify Venue', 'America/New_York')
        on conflict (id) do nothing;
        insert into public.venue_customer_relationships (id, venue_id, email, first_name, last_name)
        values ('${relId}', '${venueId}', 'delete-verify@example.com', 'Delete', 'Verify');
        insert into public.leads (
          id, venue_id, first_name, last_name, email, status, sales_stage,
          first_booked_at, acquisition_source, relationship_id
        ) values (
          '${leadId}', '${venueId}', 'Delete', 'Verify', 'delete-verify@example.com',
          'won', 'booked', '2026-01-15T12:00:00Z', 'website', '${relId}'
        );
        insert into public.clients (
          id, venue_id, lead_id, first_name, last_name, email, status,
          relationship_id, lifecycle_booked_at, lifecycle_booking_origin
        ) values (
          '${clientId}', '${venueId}', '${leadId}', 'Delete', 'Verify',
          'delete-verify@example.com', 'planning', '${relId}',
          '2026-01-15T12:00:00Z', 'pipeline'
        );
        insert into public.events (id, venue_id, client_id, name, event_date, status)
        values ('${eventId}', '${venueId}', '${clientId}', 'Delete Verify Wedding', '2025-06-01', 'complete');
        insert into public.lifecycle_booking_events (
          venue_id, lead_id, client_id, origin, event_kind, occurred_at, acquisition_source
        ) values
          ('${venueId}', '${leadId}', '${clientId}', 'pipeline', 'first_booked', '2026-01-15T12:00:00Z', 'website'),
          ('${venueId}', '${leadId}', '${clientId}', 'pipeline', 'rebooked', '2026-09-01T12:00:00Z', 'website');
        insert into public.lead_notes (venue_id, lead_id, body)
        values ('${venueId}', '${leadId}', 'Inquiry note on the lead');
        insert into public.lead_tasks (venue_id, lead_id, title)
        values ('${venueId}', '${leadId}', 'Call them back');
        insert into public.conversation_messages (
          conversation_id, venue_id, sender_type, channel, body
        )
        select id, '${venueId}', 'venue_staff', 'email', 'Welcome — we are booked.'
        from public.conversations
        where relationship_id = '${relId}'
        limit 1;
        insert into public.message_threads (id, venue_id, lead_id, channel)
        values ('${threadId}', '${venueId}', '${leadId}', 'email');
        insert into public.contracts (id, venue_id, client_id, event_id, title, content, status, signed_at)
        values (
          '${contractId}', '${venueId}', '${clientId}', '${eventId}',
          'Venue agreement', 'Signed terms.', 'signed', now()
        );
        insert into public.payment_schedules (id, venue_id, client_id, event_id, title, total_amount)
        values ('${scheduleId}', '${venueId}', '${clientId}', '${eventId}', 'Wedding payments', 5000);
        insert into public.payment_line_items (
          id, venue_id, schedule_id, label, amount, status, paid_at, paid_amount
        ) values (
          '${paymentId}', '${venueId}', '${scheduleId}', 'Deposit', 1000, 'paid', now(), 1000
        );
        insert into public.documents (
          id, venue_id, client_id, name, file_name, storage_path, storage_url, category
        ) values (
          '${docId}', '${venueId}', '${clientId}', 'Signed proposal', 'proposal.pdf',
          'documents/${venueId}/client/${clientId}/proposal.pdf', 'https://example.test/proposal.pdf', 'other'
        );
        set local session_replication_role = replica;
        insert into public.tour_appointments (
          id, venue_id, lead_id, scheduled_at, duration_minutes, status, contact_name
        ) values (
          '${tourId}', '${venueId}', '${leadId}', '2025-08-01T15:00:00Z', 60, 'completed', 'Delete Verify'
        );
        set local session_replication_role = origin;
      `);
      assert.equal(setup.status, 0, setup.stderr || setup.stdout);

      const supabase = adminClient();
      const beforeBookings = await listLifecycleBookingsInPeriod(supabase as never, venueId, {
        from: "2026-01-01",
        to: "2026-12-31",
      });
      assert.equal(beforeBookings.length, 1, "only first_booked counts in the period");
      assert.equal(beforeBookings[0]?.occurredAt.startsWith("2026-01-15"), true);

      // service_role is not GRANTed DELETE on leads (authenticated venue
      // owners are). Apply the same mutation applyLeadRecordDeletion writes.
      const deleted = psql(`
        delete from public.lifecycle_booking_events
          where venue_id = '${venueId}' and lead_id = '${leadId}';
        update public.clients
          set lifecycle_booked_at = null, lifecycle_booking_origin = null
          where id = '${clientId}' and venue_id = '${venueId}';
        delete from public.leads
          where id = '${leadId}' and venue_id = '${venueId}';
      `);
      assert.equal(deleted.status, 0, deleted.stderr || deleted.stdout);

      const leftover = psql(`
        select json_build_object(
          'leads', (select count(*)::int from public.leads where id = '${leadId}'),
          'notes', (select count(*)::int from public.lead_notes where lead_id = '${leadId}'),
          'tasks', (select count(*)::int from public.lead_tasks where lead_id = '${leadId}'),
          'lifecycle', (select count(*)::int from public.lifecycle_booking_events where venue_id = '${venueId}'),
          'threads', (select count(*)::int from public.message_threads where id = '${threadId}'),
          'client', (select count(*)::int from public.clients where id = '${clientId}'),
          'client_lead', (select lead_id from public.clients where id = '${clientId}'),
          'stamps', (
            select json_build_object('booked_at', lifecycle_booked_at, 'origin', lifecycle_booking_origin)
            from public.clients where id = '${clientId}'
          ),
          'event', (select count(*)::int from public.events where id = '${eventId}'),
          'contract', (select count(*)::int from public.contracts where id = '${contractId}'),
          'payment', (select count(*)::int from public.payment_line_items where id = '${paymentId}'),
          'doc', (select count(*)::int from public.documents where id = '${docId}'),
          'tour', (select count(*)::int from public.tour_appointments where id = '${tourId}'),
          'tour_lead', (select lead_id from public.tour_appointments where id = '${tourId}'),
          'convo', (select count(*)::int from public.conversations where relationship_id = '${relId}'),
          'messages', (
            select count(*)::int from public.conversation_messages m
            join public.conversations c on c.id = m.conversation_id
            where c.relationship_id = '${relId}'
          ),
          'rel', (select count(*)::int from public.venue_customer_relationships where id = '${relId}')
        );
      `);
      assert.equal(leftover.status, 0, leftover.stderr);
      const row = JSON.parse(leftover.stdout.split("\n").find((l) => l.trim().startsWith("{")) ?? "{}") as {
        leads: number;
        notes: number;
        tasks: number;
        lifecycle: number;
        threads: number;
        client: number;
        client_lead: string | null;
        stamps: { booked_at: string | null; origin: string | null };
        event: number;
        contract: number;
        payment: number;
        doc: number;
        tour: number;
        tour_lead: string | null;
        convo: number;
        messages: number;
        rel: number;
      };

      assert.equal(row.leads, 0);
      assert.equal(row.notes, 0);
      assert.equal(row.tasks, 0);
      assert.equal(row.lifecycle, 0);
      assert.equal(row.threads, 0);
      assert.equal(row.client, 1);
      assert.equal(row.client_lead, null);
      assert.equal(row.stamps.booked_at, null);
      assert.equal(row.stamps.origin, null);
      assert.equal(row.event, 1);
      assert.equal(row.contract, 1);
      assert.equal(row.payment, 1);
      assert.equal(row.doc, 1);
      assert.equal(row.tour, 1);
      assert.equal(row.tour_lead, null);
      assert.equal(row.convo, 1);
      assert.equal(row.messages, 1);
      assert.equal(row.rel, 1);

      const afterBookings = await listLifecycleBookingsInPeriod(supabase as never, venueId, {
        from: "2026-01-01",
        to: "2026-12-31",
      });
      assert.equal(afterBookings.length, 0);

      const resurrect = psql(`
        insert into public.lifecycle_booking_events (
          venue_id, lead_id, client_id, origin, event_kind, occurred_at, metadata
        )
        select
          c.venue_id, null, c.id, coalesce(c.lifecycle_booking_origin, 'direct'),
          'first_booked', c.lifecycle_booked_at,
          jsonb_build_object('backfill', 'pre_existing_booked')
        from public.clients c
        where c.id = '${clientId}'
          and c.lead_id is null
          and (c.lifecycle_booked_at is not null or c.lifecycle_booking_origin is not null)
          and not exists (
            select 1 from public.lifecycle_booking_events e
            where e.client_id = c.id and e.lead_id is null and e.event_kind = 'first_booked'
          );
        select count(*)::int from public.lifecycle_booking_events where venue_id = '${venueId}';
      `);
      assert.equal(resurrect.status, 0, resurrect.stderr);
      assert.match(resurrect.stdout, /0/);

      cleanup();
    });
  });
});
