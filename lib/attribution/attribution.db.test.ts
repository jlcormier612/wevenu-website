/**
 * Phase 2A attribution DB integration — freeze, Unknown, Website rollup,
 * coverage, multi-event revenue attribution, Reporting RPC frozen source.
 */
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, it, type TestContext } from "node:test";

import {
  computeSourceCoverage,
  reportingSourceDisplayLabel,
  reportingSourceGroupKey,
  timeToBookDays,
} from "@/lib/attribution/source";
import { ATTRIBUTION_FILL_RATE_SQL } from "@/lib/attribution/fill-rate";
import { recordLifecycleBooking } from "@/lib/lifecycle-bookings/service";
import { applyLocalMigrationFiles } from "@/lib/test/apply-local-migrations";
import { withLocalDbSchemaLock } from "@/lib/test/local-db-schema-lock";

const LOCAL_DB = process.env.HTC_LOCAL_DATABASE_URL
  ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const LOCAL_API = process.env.NEXT_PUBLIC_SUPABASE_URL
  ?? process.env.SUPABASE_URL
  ?? "http://127.0.0.1:54321";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const MIGRATIONS = [
  resolve("supabase/migrations/20261337000000_lifecycle_booking_events.sql"),
  resolve("supabase/migrations/20261338000000_acquisition_attribution_foundation.sql"),
  resolve("supabase/migrations/20261339000000_reporting_frozen_acquisition_source.sql"),
];

const venueId = "dddddddd-bbbb-cccc-dddd-eeeeeeeeee01";
const ownerId = "dddddddd-bbbb-cccc-dddd-eeeeeeeeee02";
const websiteLeadId = "dddddddd-bbbb-cccc-dddd-eeeeeeeeee03";
const tourLeadId = "dddddddd-bbbb-cccc-dddd-eeeeeeeeee04";
const websiteClientId = "dddddddd-bbbb-cccc-dddd-eeeeeeeeee05";
const leadlessClientId = "dddddddd-bbbb-cccc-dddd-eeeeeeeeee06";
const multiEventClientId = "dddddddd-bbbb-cccc-dddd-eeeeeeeeee07";
const multiLeadId = "dddddddd-bbbb-cccc-dddd-eeeeeeeeee08";
const igLeadId = "dddddddd-bbbb-cccc-dddd-eeeeeeeeee09";
const igClientId = "dddddddd-bbbb-cccc-dddd-eeeeeeeeee0a";
const eventAId = "dddddddd-bbbb-cccc-dddd-eeeeeeeeee11";
const eventBId = "dddddddd-bbbb-cccc-dddd-eeeeeeeeee12";

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

describe("Phase 2A acquisition attribution DB", () => {
  it("freezes acquisition_source; Unknown for leadless; Website rollup; coverage; multi-event attributed", async (t: TestContext) => {
    if (!localReady()) {
      t.skip("local Postgres is not running");
      return;
    }

    await withLocalDbSchemaLock(async () => {
      applyLocalMigrationFiles(MIGRATIONS, { dbUrl: LOCAL_DB, alreadyHoldingLock: true });
      const supabase = adminClient();

      psql(`
        delete from public.venues where id = '${venueId}';
        delete from auth.users where id = '${ownerId}';
      `);

      const setup = psql(`
        insert into auth.users (
          instance_id, id, aud, role, email, encrypted_password,
          email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
          created_at, updated_at, confirmation_token, email_change,
          email_change_token_new, recovery_token
        ) values (
          '00000000-0000-0000-0000-000000000000', '${ownerId}', 'authenticated', 'authenticated',
          'attr-owner@example.test', crypt('not-a-login', gen_salt('bf')),
          now(), '{"provider":"email","providers":["email"]}', '{}',
          now(), now(), '', '', '', ''
        );
        insert into public.venues (id, owner_user_id, name, timezone)
        values ('${venueId}', '${ownerId}', 'Attribution Venue', 'America/New_York');

        insert into public.leads (
          id, venue_id, first_name, last_name, email, status,
          source, acquisition_source, source_data, created_at
        ) values (
          '${websiteLeadId}', '${venueId}', 'Web', 'Lead', 'web@example.test', 'new',
          'website', 'website',
          '{"utm_source":"google","landing_page":"https://example.test/weddings"}'::jsonb,
          '2026-01-01T12:00:00Z'
        );

        insert into public.leads (
          id, venue_id, first_name, last_name, email, status,
          source, acquisition_source, created_at
        ) values (
          '${tourLeadId}', '${venueId}', 'Tour', 'Lead', 'tour@example.test', 'qualified',
          'tour_scheduling', 'tour_scheduling', '2026-01-02T12:00:00Z'
        );

        insert into public.leads (
          id, venue_id, first_name, last_name, email, status,
          source, acquisition_source, created_at
        ) values (
          '${multiLeadId}', '${venueId}', 'Multi', 'Lead', 'multi@example.test', 'new',
          'instagram', 'instagram', '2026-01-03T12:00:00Z'
        );

        insert into public.leads (
          id, venue_id, first_name, last_name, email, status,
          source, acquisition_source, created_at
        ) values (
          '${igLeadId}', '${venueId}', 'Ig', 'Lead', 'ig@example.test', 'new',
          'instagram', 'instagram', '2026-01-04T12:00:00Z'
        );

        insert into public.clients (id, venue_id, lead_id, first_name, last_name, email, status)
        values
          ('${websiteClientId}', '${venueId}', '${websiteLeadId}', 'Web', 'Client', 'web@example.test', 'planning'),
          ('${leadlessClientId}', '${venueId}', null, 'Direct', 'Client', 'direct@example.test', 'planning'),
          ('${multiEventClientId}', '${venueId}', '${multiLeadId}', 'Multi', 'Client', 'multi@example.test', 'planning'),
          ('${igClientId}', '${venueId}', '${igLeadId}', 'Ig', 'Client', 'ig@example.test', 'planning');
      `);
      assert.equal(setup.status, 0, setup.stderr || setup.stdout);

      // 1–2: Website lead → lifecycle booking keeps Website; source_data survives
      const book1 = await recordLifecycleBooking(supabase, {
        venueId, leadId: websiteLeadId, clientId: websiteClientId,
        origin: "pipeline", occurredAt: "2026-01-20T12:00:00Z",
      });
      assert.equal(book1.ok, true);
      const { data: ev1 } = await supabase.from("lifecycle_booking_events")
        .select("acquisition_source").eq("lead_id", websiteLeadId).eq("event_kind", "first_booked").single();
      assert.equal((ev1 as { acquisition_source: string }).acquisition_source, "website");
      const { data: leadBlob } = await supabase.from("leads")
        .select("source_data").eq("id", websiteLeadId).single();
      assert.equal((leadBlob as { source_data: { utm_source: string } }).source_data.utm_source, "google");

      // ---- Regression A: Instagram → edit operational source → frozen stays Instagram ----
      const editIg = psql(`update public.leads set source = 'referral' where id = '${igLeadId}'`);
      assert.equal(editIg.status, 0, editIg.stderr);
      const { data: igAfterEdit } = await supabase.from("leads")
        .select("source, acquisition_source").eq("id", igLeadId).single();
      assert.equal((igAfterEdit as { source: string }).source, "referral");
      assert.equal((igAfterEdit as { acquisition_source: string }).acquisition_source, "instagram");

      // Funnel drill-down RPC must read frozen acquisition_source (API column still named `source`)
      const funnelDef = psql(`
        select pg_get_functiondef('public.canonical_conversion_funnel_leads(date,date)'::regprocedure);
      `);
      assert.match(funnelDef.stdout, /l\.acquisition_source/);
      assert.equal(
        /,\s*l\.source\s*,/.test(funnelDef.stdout),
        false,
        "funnel leads RPC must not select mutable l.source",
      );

      // ---- Regression B: book → edit source → rebook → first_booked stays Instagram ----
      const igBook = await recordLifecycleBooking(supabase, {
        venueId, leadId: igLeadId, clientId: igClientId,
        origin: "pipeline", occurredAt: "2026-01-21T12:00:00Z",
      });
      assert.equal(igBook.ok, true);
      psql(`update public.leads set source = 'referral' where id = '${igLeadId}'`);
      await supabase.from("leads").update({ status: "lost" }).eq("id", igLeadId);
      const igRebook = await recordLifecycleBooking(supabase, {
        venueId, leadId: igLeadId, clientId: igClientId,
        origin: "pipeline", occurredAt: "2026-03-02T12:00:00Z", previousSalesStage: "lost",
      });
      assert.equal(igRebook.ok, true);
      if (igRebook.ok) assert.equal(igRebook.wasFirst, false);
      const { data: igFirst } = await supabase.from("lifecycle_booking_events")
        .select("acquisition_source, occurred_at").eq("lead_id", igLeadId).eq("event_kind", "first_booked").single();
      assert.equal((igFirst as { acquisition_source: string }).acquisition_source, "instagram");
      assert.ok(String((igFirst as { occurred_at: string }).occurred_at).startsWith("2026-01-21"));

      // ---- Regression C: direct clear/change acquisition_source is rejected by freeze ----
      const clearAttempt = psql(`
        update public.leads set acquisition_source = null where id = '${igLeadId}' returning acquisition_source;
      `);
      assert.equal(clearAttempt.status, 0, clearAttempt.stderr);
      assert.match(clearAttempt.stdout, /instagram/);
      const changeAttempt = psql(`
        update public.leads set acquisition_source = 'referral' where id = '${igLeadId}' returning acquisition_source;
      `);
      assert.equal(changeAttempt.status, 0, changeAttempt.stderr);
      assert.match(changeAttempt.stdout, /instagram/);
      const { data: igFrozen } = await supabase.from("leads")
        .select("acquisition_source").eq("id", igLeadId).single();
      assert.equal((igFrozen as { acquisition_source: string }).acquisition_source, "instagram");

      // Lifecycle event stamp also frozen
      const clearEv = psql(`
        update public.lifecycle_booking_events
        set acquisition_source = 'referral'
        where lead_id = '${igLeadId}' and event_kind = 'first_booked'
        returning acquisition_source;
      `);
      assert.equal(clearEv.status, 0, clearEv.stderr);
      assert.match(clearEv.stdout, /instagram/);

      // Website lead operational edit (existing scenario)
      const edit = psql(`update public.leads set source = 'referral' where id = '${websiteLeadId}'`);
      assert.equal(edit.status, 0, edit.stderr);
      const { data: leadAfter } = await supabase.from("leads")
        .select("source, acquisition_source").eq("id", websiteLeadId).single();
      assert.equal((leadAfter as { source: string }).source, "referral");
      assert.equal((leadAfter as { acquisition_source: string }).acquisition_source, "website");
      const { data: evStill } = await supabase.from("lifecycle_booking_events")
        .select("acquisition_source").eq("lead_id", websiteLeadId).eq("event_kind", "first_booked").single();
      assert.equal((evStill as { acquisition_source: string }).acquisition_source, "website");

      // Rebook does not overwrite first acquisition
      await supabase.from("leads").update({ status: "lost" }).eq("id", websiteLeadId);
      const rebook = await recordLifecycleBooking(supabase, {
        venueId, leadId: websiteLeadId, clientId: websiteClientId,
        origin: "pipeline", occurredAt: "2026-03-01T12:00:00Z", previousSalesStage: "lost",
      });
      assert.equal(rebook.ok, true);
      if (rebook.ok) assert.equal(rebook.wasFirst, false);
      const { data: firstStill } = await supabase.from("lifecycle_booking_events")
        .select("acquisition_source, occurred_at").eq("lead_id", websiteLeadId).eq("event_kind", "first_booked").single();
      assert.equal((firstStill as { acquisition_source: string }).acquisition_source, "website");
      assert.ok(String((firstStill as { occurred_at: string }).occurred_at).startsWith("2026-01-20"));

      // Direct / leadless → Unknown
      const direct = await recordLifecycleBooking(supabase, {
        venueId, clientId: leadlessClientId, origin: "direct", occurredAt: "2026-01-25T12:00:00Z",
      });
      assert.equal(direct.ok, true);
      const { data: directEv } = await supabase.from("lifecycle_booking_events")
        .select("acquisition_source").eq("client_id", leadlessClientId).eq("event_kind", "first_booked").single();
      assert.equal((directEv as { acquisition_source: string | null }).acquisition_source, null);

      // tour_scheduling display → Website; raw intact
      assert.equal(reportingSourceGroupKey("tour_scheduling"), "website");
      assert.equal(reportingSourceDisplayLabel("tour_scheduling"), "Website");
      const { data: tourLead } = await supabase.from("leads")
        .select("source, acquisition_source").eq("id", tourLeadId).single();
      assert.equal((tourLead as { source: string }).source, "tour_scheduling");
      assert.equal((tourLead as { acquisition_source: string }).acquisition_source, "tour_scheduling");

      const tourLeadSource = (tourLead as { acquisition_source: string }).acquisition_source;
      assert.equal(reportingSourceGroupKey(tourLeadSource), "website");
      assert.equal(reportingSourceGroupKey(null), "unknown");

      // Coverage denominator includes Unknown
      const { data: firsts } = await supabase.from("lifecycle_booking_events")
        .select("acquisition_source").eq("venue_id", venueId).eq("event_kind", "first_booked");
      const cov = computeSourceCoverage(
        ((firsts ?? []) as { acquisition_source: string | null }[]).map((r) => r.acquisition_source),
      );
      assert.ok(cov.total >= 2);
      assert.ok(cov.known < cov.total);
      assert.ok(cov.percent < 100);

      assert.equal(timeToBookDays("2026-01-01T12:00:00Z", "2026-01-20T12:00:00Z"), 19);

      // Multi-event client: one originating lead → still attributed (not Unknown)
      psql(`
        insert into public.events (id, venue_id, client_id, name, event_date, status)
        values
          ('${eventAId}', '${venueId}', '${multiEventClientId}', 'Event A', '2026-06-01', 'confirmed'),
          ('${eventBId}', '${venueId}', '${multiEventClientId}', 'Event B', '2026-07-01', 'confirmed');
      `);
      const {
        resolveDeterministicClientAcquisitionSource,
        resolveDeterministicFinancialAcquisitionSource,
      } = await import("@/lib/attribution/resolve-client");
      const map = await resolveDeterministicClientAcquisitionSource(
        supabase, venueId, [multiEventClientId, websiteClientId, leadlessClientId, igClientId],
      );
      assert.equal(map.get(multiEventClientId), "instagram");
      assert.equal(map.get(leadlessClientId), null);
      assert.equal(map.get(websiteClientId), "website");
      assert.equal(map.get(igClientId), "instagram");

      // Event-linked financial rows stay Instagram even with multiple events
      const fin = await resolveDeterministicFinancialAcquisitionSource(supabase, venueId, [
        { id: "inv-a", clientId: multiEventClientId, eventId: eventAId },
        { id: "inv-b", clientId: multiEventClientId, eventId: eventBId },
        { id: "inv-mismatch", clientId: websiteClientId, eventId: eventAId },
      ]);
      assert.equal(fin.get("inv-a"), "instagram");
      assert.equal(fin.get("inv-b"), "instagram");
      assert.equal(fin.get("inv-mismatch"), null);

      // get_venue_analytics bySource uses acquisition_source
      const analyticsDef = psql(`
        select pg_get_functiondef('public.get_venue_analytics()'::regprocedure);
      `);
      assert.match(analyticsDef.stdout, /acquisition_source as source/);

      // Fill-rate SQL runs without error (inventory)
      const fill = psql(ATTRIBUTION_FILL_RATE_SQL);
      assert.equal(fill.status, 0, fill.stderr || fill.stdout);

      psql(`
        delete from public.venues where id = '${venueId}';
        delete from auth.users where id = '${ownerId}';
      `);
    });
  });
});
