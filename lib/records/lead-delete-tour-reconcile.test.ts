/**
 * Duplicate-lead delete must not leave phantom tour capacity or confirmable orphans.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

const deleteSvc = readFileSync(resolve("lib/records/delete-record.ts"), "utf8");
const migration = readFileSync(
  resolve("supabase/migrations/20261418900000_lead_delete_tour_capacity_and_confirm.sql"),
  "utf8",
);
const confirmMigration = readFileSync(
  resolve("supabase/migrations/20261313000000_tour_confirmation.sql"),
  "utf8",
);
const occupancy = readFileSync(
  resolve("supabase/migrations/20261410400000_tour_two_clock_schema.sql"),
  "utf8",
);
const archiveMig = readFileSync(
  resolve("supabase/migrations/20261407700000_tour_appointments_archive.sql"),
  "utf8",
);
const confirmPage = readFileSync(resolve("app/confirm/[token]/page.tsx"), "utf8");
const tourService = readFileSync(resolve("lib/tours/service.ts"), "utf8");
const duplicateReview = readFileSync(resolve("lib/leads/duplicate-review.ts"), "utf8");

describe("lead delete ↔ tour capacity reconciliation", () => {
  it("occupancy counts scheduled/confirmed and historically ignored is_archived", () => {
    assert.match(occupancy, /ta\.status in \('scheduled', 'confirmed'\)/);
    assert.doesNotMatch(
      occupancy.slice(occupancy.indexOf("select count(*)::integer into v_count")),
      /is_archived/,
    );
    assert.match(archiveMig, /List hygiene/);
  });

  it("lead delete cancels occupying tours then archives (idempotent path)", () => {
    const apply = deleteSvc.slice(deleteSvc.indexOf("export async function applyLeadRecordDeletion"));
    assert.match(apply, /occupyingTours|occupyingIds/);
    assert.match(apply, /status: "cancelled"/);
    assert.match(apply, /is_archived: true/);
    assert.match(apply, /task_reminders/);
  });

  it("heal migration cancels archived null-lead occupying rows", () => {
    assert.match(migration, /is_archived = true/);
    assert.match(migration, /lead_id is null/);
    assert.match(migration, /status in \('scheduled', 'confirmed'\)/);
    assert.match(migration, /set status = 'cancelled'/);
  });

  it("does not invent silent email-based tour transfer on delete", () => {
    const apply = deleteSvc.slice(deleteSvc.indexOf("export async function applyLeadRecordDeletion"));
    assert.doesNotMatch(apply, /matched_lead|surviving|transfer.*tour|reassign.*lead/i);
    assert.doesNotMatch(apply, /contact_email/);
  });
});

describe("confirmation link lifecycle safety after lead delete", () => {
  it("confirm_tour_by_token rejects archived tours", () => {
    const fn = migration.slice(migration.indexOf("create or replace function public.confirm_tour_by_token"));
    assert.match(fn, /is_archived/);
    assert.match(fn, /not_confirmable/);
    const archivedCheck = fn.indexOf("if v_appt.is_archived");
    const confirmedCheck = fn.indexOf("if v_appt.status = 'confirmed'");
    assert.ok(archivedCheck > 0 && archivedCheck < confirmedCheck);
  });

  it("get_tour_by_confirm_token does not present archived scheduled tours as confirmable", () => {
    const fn = migration.slice(migration.indexOf("create or replace function public.get_tour_by_confirm_token"));
    assert.match(fn, /is_archived/);
    assert.match(fn, /v_row\.status := 'cancelled'/);
  });

  it("public confirm page shows unavailable for non-scheduled without false success", () => {
    assert.match(confirmPage, /This tour is no longer available to confirm/);
    assert.match(confirmPage, /tour\.status !== "scheduled"/);
    assert.match(confirmPage, /already confirmed/);
  });

  it("confirmTourByToken maps not_confirmable and skips re-send on alreadyConfirmed", () => {
    const fn = tourService.slice(tourService.indexOf("export async function confirmTourByToken"));
    assert.match(fn, /not_confirmable/);
    assert.match(fn, /alreadyConfirmed/);
    assert.match(fn, /Fresh confirmation only — never re-send on alreadyConfirmed/);
  });

  it("original confirm migration remains the prospect_link-only write path", () => {
    assert.match(confirmMigration, /confirmation_source = 'prospect_link'/);
    assert.match(confirmMigration, /status <> 'scheduled'/);
  });
});

describe("duplicate detection still independent of delete reconciliation", () => {
  it("possible-duplicate review does not auto-merge Relationships", () => {
    assert.match(duplicateReview, /never merges Relationships/);
    assert.doesNotMatch(duplicateReview, /relationship_id:\s*matched/);
  });
});
