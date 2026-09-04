/**
 * Floor Plan Phase 3 live verification against local Supabase.
 *
 * Proves Upload → Normalize → Match → Review → Approve/Exclude → Commit →
 * Reopen → first-class Document / template / floor_plan objects — not mocks.
 *
 * Hosted Sandbox cannot run this until Phase 3 is deployed; this is the
 * release-verification substitute when code is local-only.
 */
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, it, type TestContext } from "node:test";

import { canDeleteFloorPlanRows, canEditFloorPlans } from "@/lib/floor-plans/authorize";
import { collectFloorPlanUploadFiles } from "@/lib/migration/floor-plan-zip";
import {
  evaluateFloorPlanMatch,
  proposeFloorPlanScopeFromFileName,
} from "@/lib/migration/floor-plan-import";
import * as repo from "@/lib/migration/repository";
import {
  addRows,
  commitSession,
  computeSessionResumeState,
  getSessionSummary,
  runDedupe,
} from "@/lib/migration/service";
import { formatSessionOutcomeSentence } from "@/lib/migration/session-accounting";
import { applyLocalMigrationFiles } from "@/lib/test/apply-local-migrations";
import { withLocalDbSchemaLock } from "@/lib/test/local-db-schema-lock";

const LOCAL_DB = process.env.HTC_LOCAL_DATABASE_URL
  ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const LOCAL_API = process.env.NEXT_PUBLIC_SUPABASE_URL
  ?? process.env.SUPABASE_URL
  ?? "http://127.0.0.1:54321";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const FIXTURES = "/tmp/fp-phase3-fixtures";
const MIGRATION_ENTITY = resolve("supabase/migrations/20261336000000_floor_plan_migration_entity.sql");
const MIGRATION_BG_DOC = resolve("supabase/migrations/20261334000000_floor_plan_background_document.sql");

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

function applySchemaPatches(): void {
  applyLocalMigrationFiles([MIGRATION_BG_DOC, MIGRATION_ENTITY], {
    dbUrl: LOCAL_DB,
    alreadyHoldingLock: true,
  });
}

function adminClient(): SupabaseClient {
  return createClient(LOCAL_API, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function uploadOriginal(
  supabase: SupabaseClient,
  venueId: string,
  fileName: string,
  bytes: Buffer,
  mimeType: string,
): Promise<{ storagePath: string; storageUrl: string }> {
  const planId = crypto.randomUUID();
  const docId = crypto.randomUUID();
  const ext = fileName.split(".").pop() ?? "bin";
  const storagePath = `${venueId}/floor_plan/${planId}/${docId}.${ext}`;
  const { error } = await supabase.storage.from("documents").upload(storagePath, bytes, {
    upsert: false,
    contentType: mimeType,
  });
  assert.equal(error, null, error?.message ?? "upload failed");
  const { data } = supabase.storage.from("documents").getPublicUrl(storagePath);
  return { storagePath, storageUrl: data.publicUrl };
}

describe("Floor Plan Phase 3 live E2E (local Supabase)", () => {
  it("image + PDF + ZIP matching, commit scopes, exclude, replace/remove, permissions", async (t: TestContext) => {
    if (!localReady()) {
      t.skip("local Postgres is not running");
      return;
    }
    await withLocalDbSchemaLock(async () => {
      applySchemaPatches();
      const supabase = adminClient();

      const venueId = "cccccccc-dddd-eeee-ffff-0000000000a1";
      const ownerId = "cccccccc-dddd-eeee-ffff-0000000000a2";
      const clientId = "cccccccc-dddd-eeee-ffff-0000000000a3";
      const eventId = "cccccccc-dddd-eeee-ffff-0000000000a4";
      const barnId = "cccccccc-dddd-eeee-ffff-0000000000b1";
      const bridgeId = "cccccccc-dddd-eeee-ffff-0000000000b2";
      const hallA = "cccccccc-dddd-eeee-ffff-0000000000b3";
      const hallB = "cccccccc-dddd-eeee-ffff-0000000000b4";

      psql(`
        grant select, insert, update, delete on public.venue_spaces to service_role;
        grant select, insert, update, delete on public.floor_plans to service_role;
        grant select, insert, update, delete on public.floor_plan_templates to service_role;
        grant select, insert, update, delete on public.documents to service_role;
        delete from public.migration_records where venue_id = '${venueId}';
        delete from public.migration_sessions where venue_id = '${venueId}';
        delete from public.documents where venue_id = '${venueId}';
        delete from public.floor_plan_templates where venue_id = '${venueId}';
        delete from public.floor_plans where venue_id = '${venueId}';
        delete from public.events where venue_id = '${venueId}';
        delete from public.clients where venue_id = '${venueId}';
        delete from public.venue_spaces where venue_id = '${venueId}';
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
          'fp-phase3-owner@example.test', crypt('not-a-login', gen_salt('bf')),
          now(), '{"provider":"email","providers":["email"]}', '{}',
          now(), now(), '', '', '', ''
        );
        insert into public.venues (id, owner_user_id, name, timezone)
        values ('${venueId}', '${ownerId}', 'Floor Plan Phase3 Venue', 'America/New_York');
        insert into public.venue_spaces (id, venue_id, name) values
          ('${barnId}', '${venueId}', 'Barn'),
          ('${bridgeId}', '${venueId}', 'Covered Bridge'),
          ('${hallA}', '${venueId}', 'Hall A'),
          ('${hallB}', '${venueId}', 'Hall B');
        insert into public.clients (id, venue_id, first_name, last_name, email, status)
        values ('${clientId}', '${venueId}', 'Emma', 'Jordan', 'emma-jordan@example.test', 'confirmed');
        insert into public.events (id, venue_id, client_id, name, event_date, guest_count, status)
        values ('${eventId}', '${venueId}', '${clientId}', 'Emma & Jordan''s Wedding', '2026-10-17', 120, 'confirmed');
      `);
      assert.equal(setup.status, 0, setup.stderr || setup.stdout);

      // --- ZIP expand (client path) ---
      const zipBytes = readFileSync(`${FIXTURES}/floor-plans-batch.zip`);
      const zipFile = new File([zipBytes], "floor-plans-batch.zip", { type: "application/zip" });
      const zipResult = await collectFloorPlanUploadFiles([zipFile]);
      assert.equal(zipResult.files.length, 4, "ZIP should yield 4 floor-plan files");
      assert.equal(zipResult.skippedNonFloorPlan, 1, "notes.txt should be skipped, not silently imported");
      assert.ok(zipResult.files.every((f) => f.fileName !== "notes.txt"));

      // --- Pure matching scenarios ---
      const spaces = [
        { id: barnId, name: "Barn" },
        { id: bridgeId, name: "Covered Bridge" },
        { id: hallA, name: "Hall A" },
        { id: hallB, name: "Hall B" },
      ];
      const events = [{ id: eventId, name: "Emma & Jordan's Wedding", eventDate: "2026-10-17" }];

      const barnProposal = proposeFloorPlanScopeFromFileName("Barn-master-floorplan.png", spaces.map((s) => s.name));
      assert.equal(barnProposal.scope, "space_master");
      assert.equal(barnProposal.spaceName, "Barn");
      const barnMatch = evaluateFloorPlanMatch({
        name: "Barn master floorplan",
        fileName: "Barn-master-floorplan.png",
        storagePath: "x",
        storageUrl: "https://example.test/x",
        renderableImageUrl: "https://example.test/x",
        mimeType: "image/png",
        fileSize: "10",
        scope: "space_master",
        spaceId: null,
        spaceName: "Barn",
        eventId: null,
        eventName: null,
        eventDate: null,
        sourceId: "barn-src",
        notes: null,
      }, spaces, events);
      assert.equal(barnMatch.status, "validated");
      assert.equal(barnMatch.patch.spaceId, barnId);

      const eventProposal = proposeFloorPlanScopeFromFileName("Emma-Jordan-2026-10-17-reception.png", spaces.map((s) => s.name));
      assert.equal(eventProposal.scope, "event_specific");
      assert.equal(eventProposal.eventDate, "2026-10-17");
      const eventMatch = evaluateFloorPlanMatch({
        name: "Emma Jordan 2026 10 17 reception",
        fileName: "Emma-Jordan-2026-10-17-reception.png",
        storagePath: "y",
        storageUrl: "https://example.test/y",
        renderableImageUrl: "https://example.test/y",
        mimeType: "image/png",
        fileSize: "10",
        scope: "event_specific",
        spaceId: null,
        spaceName: null,
        eventId: null,
        eventName: null,
        eventDate: "2026-10-17",
        sourceId: "evt-src",
        notes: null,
      }, spaces, events);
      assert.equal(eventMatch.status, "validated");
      assert.equal(eventMatch.patch.eventId, eventId);

      const ambMatch = evaluateFloorPlanMatch({
        name: "Hall layout",
        fileName: "ambiguous-hall-layout.png",
        storagePath: "z",
        storageUrl: "https://example.test/z",
        renderableImageUrl: "https://example.test/z",
        mimeType: "image/png",
        fileSize: "10",
        scope: "space_master",
        spaceId: null,
        spaceName: "Hall",
        eventId: null,
        eventName: null,
        eventDate: null,
        sourceId: "amb-src",
        notes: null,
      }, spaces, events);
      assert.equal(ambMatch.status, "needs_review", "ambiguous Hall A/B must not auto-assign");
      assert.equal(ambMatch.matchedEntityId, null);

      // --- Upload real fixtures + full migration session ---
      const png = readFileSync(`${FIXTURES}/Barn-master-floorplan.png`);
      const pdf = readFileSync(`${FIXTURES}/Barn-master.pdf`);
      const eventPng = readFileSync(`${FIXTURES}/Emma-Jordan-2026-10-17-reception.png`);
      const refPng = readFileSync(`${FIXTURES}/general-reference-sketch.png`);
      const ambPng = readFileSync(`${FIXTURES}/ambiguous-hall-layout.png`);
      const bridgePng = readFileSync(`${FIXTURES}/Covered-Bridge-layout.png`);

      const barnUp = await uploadOriginal(supabase, venueId, "Barn-master-floorplan.png", png, "image/png");
      const pdfUp = await uploadOriginal(supabase, venueId, "Barn-master.pdf", pdf, "application/pdf");
      // PDF page-1 derivative would be client-side; for commit we supply a renderable PNG URL
      // while keeping the original PDF as Document SoR.
      const pdfPreview = await uploadOriginal(supabase, venueId, "Barn-master-preview.png", png, "image/png");
      const eventUp = await uploadOriginal(supabase, venueId, "Emma-Jordan-2026-10-17-reception.png", eventPng, "image/png");
      const refUp = await uploadOriginal(supabase, venueId, "general-reference-sketch.png", refPng, "image/png");
      const ambUp = await uploadOriginal(supabase, venueId, "ambiguous-hall-layout.png", ambPng, "image/png");
      const bridgeUp = await uploadOriginal(supabase, venueId, "Covered-Bridge-layout.png", bridgePng, "image/png");

      const session = await repo.createSession(supabase as never, venueId, "generic_csv", "venue", ownerId, null);
      assert.ok(session);

      const rows = [
        {
          name: "Barn master floorplan",
          fileName: "Barn-master-floorplan.png",
          ...barnUp,
          renderableImageUrl: barnUp.storageUrl,
          mimeType: "image/png",
          fileSize: String(png.length),
          scope: "space_master",
          spaceId: null,
          spaceName: "Barn",
          eventId: null,
          eventName: null,
          eventDate: null,
          sourceId: barnUp.storagePath,
          sourceRowRef: "zip:Barn-master-floorplan.png",
        },
        {
          name: "Barn master PDF",
          fileName: "Barn-master.pdf",
          storagePath: pdfUp.storagePath,
          storageUrl: pdfUp.storageUrl,
          renderableImageUrl: pdfPreview.storageUrl,
          mimeType: "application/pdf",
          fileSize: String(pdf.length),
          scope: "space_master",
          spaceId: null,
          spaceName: "Barn",
          eventId: null,
          eventName: null,
          eventDate: null,
          sourceId: pdfUp.storagePath,
          sourceRowRef: "file:Barn-master.pdf",
        },
        {
          name: "Emma Jordan reception",
          fileName: "Emma-Jordan-2026-10-17-reception.png",
          ...eventUp,
          renderableImageUrl: eventUp.storageUrl,
          mimeType: "image/png",
          fileSize: String(eventPng.length),
          scope: "event_specific",
          spaceId: null,
          spaceName: null,
          eventId: null,
          eventName: null,
          eventDate: "2026-10-17",
          sourceId: eventUp.storagePath,
          sourceRowRef: "zip:Emma-Jordan-2026-10-17-reception.png",
        },
        {
          name: "general reference sketch",
          fileName: "general-reference-sketch.png",
          ...refUp,
          renderableImageUrl: refUp.storageUrl,
          mimeType: "image/png",
          fileSize: String(refPng.length),
          scope: "general_reference",
          spaceId: null,
          spaceName: null,
          eventId: null,
          eventName: null,
          eventDate: null,
          sourceId: refUp.storagePath,
          sourceRowRef: "zip:general-reference-sketch.png",
        },
        {
          name: "ambiguous hall layout",
          fileName: "ambiguous-hall-layout.png",
          ...ambUp,
          renderableImageUrl: ambUp.storageUrl,
          mimeType: "image/png",
          fileSize: String(ambPng.length),
          scope: "space_master",
          spaceId: null,
          spaceName: "Hall",
          eventId: null,
          eventName: null,
          eventDate: null,
          sourceId: ambUp.storagePath,
          sourceRowRef: "file:ambiguous-hall-layout.png",
        },
        {
          name: "Covered Bridge layout",
          fileName: "Covered-Bridge-layout.png",
          ...bridgeUp,
          renderableImageUrl: bridgeUp.storageUrl,
          mimeType: "image/png",
          fileSize: String(bridgePng.length),
          scope: "space_master",
          spaceId: null,
          spaceName: "Covered Bridge",
          eventId: null,
          eventName: null,
          eventDate: null,
          sourceId: bridgeUp.storagePath,
          sourceRowRef: "zip:Covered-Bridge-layout.png",
        },
      ];

      const added = await addRows(supabase as never, session, "floor_plan", rows);
      assert.equal(added.added, 6);
      await runDedupe(supabase as never, session);

      const afterMatch = await repo.listRecords(supabase as never, session.id);
      const byName = (n: string) => afterMatch.find((r) => (r.normalizedPayload?.fileName as string) === n)!;

      assert.equal(byName("Barn-master-floorplan.png").status, "validated");
      assert.equal(byName("Barn-master.pdf").status, "validated");
      assert.equal(byName("Emma-Jordan-2026-10-17-reception.png").status, "validated");
      assert.equal(byName("general-reference-sketch.png").status, "validated");
      assert.equal(byName("Covered-Bridge-layout.png").status, "validated");
      assert.equal(byName("ambiguous-hall-layout.png").status, "needs_review");

      // Explicit exclusion of Covered Bridge (user intentional skip)
      await repo.updateRecord(supabase as never, byName("Covered-Bridge-layout.png").id, {
        status: "rejected",
        reviewedBy: ownerId,
        reviewedAt: new Date().toISOString(),
      });

      // Resolve ambiguous → Hall A, then approve
      await repo.updateRecord(supabase as never, byName("ambiguous-hall-layout.png").id, {
        status: "approved",
        matchType: "exact",
        matchedEntityId: hallA,
        matchConfidence: 100,
        normalizedPayload: {
          ...byName("ambiguous-hall-layout.png").normalizedPayload!,
          scope: "space_master",
          spaceId: hallA,
          spaceName: "Hall A",
        },
        validationErrors: null,
        reviewedBy: ownerId,
        reviewedAt: new Date().toISOString(),
      });

      // Approve validated rows for commit
      for (const r of await repo.listRecords(supabase as never, session.id)) {
        if (r.status === "validated") {
          await repo.updateRecord(supabase as never, r.id, {
            status: "approved",
            reviewedBy: ownerId,
            reviewedAt: new Date().toISOString(),
          });
        }
      }

      const outcome = await commitSession(supabase as never, session, ownerId);
      assert.equal(outcome.committed, 5, `expected 5 commits, got ${outcome.committed}; failed=${outcome.failed}`);
      assert.equal(outcome.failed, 0);

      const afterCommit = await repo.listRecords(supabase as never, session.id);
      assert.equal(afterCommit.filter((r) => r.status === "committed").length, 5);
      assert.equal(afterCommit.filter((r) => r.status === "rejected").length, 1);

      // Reopen accounting
      const summary = await getSessionSummary(supabase as never, session);
      const sentence = formatSessionOutcomeSentence(summary.counts);
      assert.match(sentence, /5 imported/);
      assert.match(sentence, /intentionally excluded/);
      assert.equal(computeSessionResumeState(summary.counts), "done");

      // --- First-class business objects ---
      const { data: docs } = await supabase.from("documents")
        .select("id, name, category, file_name, mime_type, storage_path, storage_url, event_id, lead_id, client_id, vendor_id")
        .eq("venue_id", venueId)
        .eq("category", "floor_plan");
      assert.ok(docs && docs.length >= 5);
      const pdfDoc = docs!.find((d) => d.file_name === "Barn-master.pdf");
      assert.ok(pdfDoc, "original PDF must be the Document SoR");
      assert.equal(pdfDoc!.mime_type, "application/pdf");
      assert.equal(pdfDoc!.category, "floor_plan");
      // PDF preview PNG must NOT be a second floor_plan Document presented as SoR
      const previewAsDoc = docs!.find((d) => d.storage_path === pdfPreview.storagePath && d.category === "floor_plan");
      assert.equal(previewAsDoc, undefined, "PDF page-1 derivative must not be the source Document");

      const { data: templates } = await supabase.from("floor_plan_templates")
        .select("id, name, space_id, background_image_url, background_document_id")
        .eq("venue_id", venueId);
      assert.ok(templates && templates.length >= 3);
      const barnTemplate = templates!.find((t) => t.space_id === barnId && t.background_document_id);
      assert.ok(barnTemplate, "space master → real template + Document");
      const barnDoc = docs!.find((d) => d.id === barnTemplate!.background_document_id);
      assert.ok(barnDoc);
      assert.match(barnDoc!.file_name ?? "", /Barn-master/);

      const hallTemplate = templates!.find((t) => t.space_id === hallA);
      assert.ok(hallTemplate, "resolved ambiguous match creates Hall A template");

      const bridgeTemplate = templates!.find((t) => t.space_id === bridgeId);
      assert.equal(bridgeTemplate, undefined, "excluded Covered Bridge must not create a template");

      const { data: plans } = await supabase.from("floor_plans")
        .select("id, name, event_id, background_image_url, background_document_id")
        .eq("venue_id", venueId)
        .eq("event_id", eventId);
      assert.ok(plans && plans.length === 1);
      const eventPlan = plans![0]!;
      assert.ok(eventPlan.background_document_id);
      const eventDoc = docs!.find((d) => d.id === eventPlan.background_document_id);
      assert.equal(eventDoc?.event_id, eventId);
      assert.equal(eventDoc?.file_name, "Emma-Jordan-2026-10-17-reception.png");

      const refDoc = docs!.find((d) => d.file_name === "general-reference-sketch.png");
      assert.ok(refDoc);
      assert.equal(refDoc!.event_id, null, "general reference stays venue-level (no event_id)");
      assert.equal(refDoc!.lead_id, null);
      assert.equal(refDoc!.client_id, null);
      assert.equal(refDoc!.vendor_id, null);
      const fakePlanForRef = (plans ?? []).find((p) => p.background_document_id === refDoc!.id);
      assert.equal(fakePlanForRef, undefined, "no fake floor_plans row for general reference");

      // --- Replace / remove safety on event plan ---
      const originalDocId = eventPlan.background_document_id as string;
      const replacement = await uploadOriginal(supabase, venueId, "replacement.png", png, "image/png");
      const { data: newDocRow, error: newDocErr } = await supabase.from("documents").insert({
        venue_id: venueId,
        event_id: eventId,
        name: "replacement",
        category: "floor_plan",
        file_name: "replacement.png",
        file_size: png.length,
        mime_type: "image/png",
        storage_path: replacement.storagePath,
        storage_url: replacement.storageUrl,
        tags: ["migration", "floor_plan"],
      }).select("id").single();
      assert.equal(newDocErr, null, newDocErr?.message);
      await supabase.from("floor_plans").update({
        background_image_url: replacement.storageUrl,
        background_document_id: newDocRow!.id,
      }).eq("id", eventPlan.id).eq("venue_id", venueId);

      const { data: afterReplace } = await supabase.from("floor_plans")
        .select("background_document_id, background_image_url")
        .eq("id", eventPlan.id).single();
      assert.equal(afterReplace!.background_document_id, newDocRow!.id);
      const { data: originalStillThere } = await supabase.from("documents")
        .select("id").eq("id", originalDocId).maybeSingle();
      assert.ok(originalStillThere, "original Document must remain after replace");

      await supabase.from("floor_plans").update({
        background_image_url: null,
        background_document_id: null,
      }).eq("id", eventPlan.id).eq("venue_id", venueId);
      const { data: afterRemove } = await supabase.from("floor_plans")
        .select("id, background_document_id, background_image_url")
        .eq("id", eventPlan.id).single();
      assert.ok(afterRemove, "floor plan row still exists after background remove");
      assert.equal(afterRemove!.background_document_id, null);
      const { data: docsStill } = await supabase.from("documents").select("id")
        .in("id", [originalDocId, newDocRow!.id]);
      assert.equal(docsStill?.length, 2, "Documents must not be deleted merely because background was detached");

      // --- Permissions (Phase 1 helpers — migration must not bypass) ---
      assert.equal(canEditFloorPlans("staff"), false);
      assert.equal(canDeleteFloorPlanRows("staff"), false);
      assert.equal(canEditFloorPlans("coordinator"), true);
      assert.equal(canDeleteFloorPlanRows("coordinator"), false);
      assert.equal(canEditFloorPlans("owner"), true);
      assert.equal(canDeleteFloorPlanRows("manager"), true);

      // --- Legacy URL-only quantification on this DB after our inserts ---
      const legacy = psql(`
        select
          (select count(*) from floor_plans
            where background_image_url is not null and background_image_url <> ''
              and background_document_id is null) as fp_url_only,
          (select count(*) from floor_plan_templates
            where background_image_url is not null and background_image_url <> ''
              and background_document_id is null) as tmpl_url_only;
      `);
      assert.equal(legacy.status, 0, legacy.stderr);
      // After our Phase 3 commits + intentional nulling, URL-only may include the removed plan (null doc + null url = 0)
      // and any pre-existing templates without backgrounds — report only; no assertion that forces backfill.

      // Leave no floor_plan migration_records behind — older db tests re-apply
      // narrower target_entity_type checks that would fail if these rows remain.
      psql(`delete from public.migration_records where venue_id = '${venueId}' and target_entity_type = 'floor_plan';`);
    });
  });
});
