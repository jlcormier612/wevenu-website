import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  formatClientDeleteFailureMessage,
  formatLeadDeleteBlockedMessage,
  formatLeadDeleteFailureMessage,
} from "@/lib/records/deletion-contract";

const svc = readFileSync(resolve("lib/records/delete-record.ts"), "utf8");
const contract = readFileSync(resolve("lib/records/deletion-contract.ts"), "utf8");
const leadDetail = readFileSync(resolve("components/leads/lead-detail.tsx"), "utf8");
const clientPage = readFileSync(resolve("app/(app)/clients/[id]/page.tsx"), "utf8");
const dialog = readFileSync(resolve("components/records/delete-record-button.tsx"), "utf8");
const dashboard = readFileSync(resolve("lib/dashboard/service.ts"), "utf8");
const attention = readFileSync(resolve("lib/navigation/attention-service.ts"), "utf8");
const leadActions = readFileSync(resolve("app/(app)/leads/[id]/actions.ts"), "utf8");

describe("Delete vs Lost", () => {
  it("delete confirmation explains reporting impact and is not Lost", () => {
    assert.match(svc, /This is not the same as Lost/);
    assert.match(svc, /Lead count will decrease by 1/);
    assert.match(svc, /no longer affect conversion rates/);
    assert.match(svc, /Booking history/);
    assert.match(dialog, /Reporting impact/);
    assert.match(dialog, /LibraryDeleteConfirmDialog/);
  });

  it("lead and client surfaces expose Delete", () => {
    assert.match(leadDetail, /DeleteRecordButton/);
    assert.match(leadDetail, /deleteLeadRecordAction/);
    assert.match(clientPage, /DeleteClientRecordButton/);
  });

  it("refuses client delete when signed contracts or collected payments exist", () => {
    assert.match(svc, /signed contract or collected payments/);
    assert.match(svc, /cannot be deleted/);
  });

  it("removes lifecycle booking events so reporting cannot keep a deleted Booking", () => {
    assert.match(svc, /lifecycle_booking_events/);
    assert.match(svc, /removeLifecycleEventsFor/);
  });

  it("clears client lifecycle stamps so a leadless backfill cannot resurrect the Booking", () => {
    assert.match(svc, /applyLeadRecordDeletion/);
    assert.match(svc, /lifecycle_booked_at: null/);
    assert.match(svc, /lifecycle_booking_origin: null/);
  });
});

describe("Global deleted-record visibility — deletion contract", () => {
  it("documents hard-delete + CASCADE/SET NULL/RESTRICT without soft-delete", () => {
    assert.match(contract, /hard delete/i);
    assert.doesNotMatch(svc, /deleted_at/);
    assert.doesNotMatch(svc, /exclude_from_business_reporting/);
    assert.match(contract, /no exclude_from_business_reporting/);
    assert.match(contract, /tour_protection_requests/);
    assert.match(contract, /CASCADE/);
    assert.match(contract, /SET NULL/);
    assert.match(contract, /RESTRICT/);
  });

  it("preflights tour protection and archives tours before lead hard delete", () => {
    assert.match(svc, /tour_protection_requests/);
    assert.match(svc, /formatLeadDeleteBlockedMessage/);
    assert.match(svc, /tour_appointments/);
    assert.match(svc, /is_archived: true/);
    assert.match(svc, /luv_drafts/);
    assert.match(svc, /entity_type", "lead"/);
    assert.match(svc, /count: "exact"/);
  });

  it("failed delete UX keeps the dialog open and does not claim success", () => {
    const confirmFn = dialog.slice(dialog.indexOf("async function confirm"), dialog.indexOf("const name ="));
    assert.match(confirmFn, /Keep dialog open and record intact/);
    assert.match(confirmFn, /was not removed/);
    const failBranch = confirmFn.slice(
      confirmFn.indexOf("if (!result.ok)"),
      confirmFn.indexOf("setOpen(false)"),
    );
    assert.match(failBranch, /toast\.error/);
    assert.match(failBranch, /return;/);
    assert.doesNotMatch(failBranch, /toast\.success/);
  });

  it("active Focus / nav task reads require a live lead (!inner)", () => {
    assert.match(dashboard, /lead_tasks[\s\S]*leads!inner/);
    assert.match(dashboard, /lead_activities[\s\S]*leads!inner/);
    assert.match(attention, /lead_tasks[\s\S]*leads!inner/);
  });

  it("successful lead delete revalidates Dashboard and Tours", () => {
    assert.match(leadActions, /revalidatePath\("\/dashboard"\)/);
    assert.match(leadActions, /revalidatePath\("\/tours"\)/);
  });

  it("formats RESTRICT / FK failures as non-success venue copy", () => {
    assert.match(
      formatLeadDeleteBlockedMessage({ kind: "tour_protection", count: 2 }),
      /cannot be deleted/,
    );
    assert.match(
      formatLeadDeleteFailureMessage({ code: "23503", message: "foreign key", details: "tour_protection_requests" }),
      /tour protection|cannot be deleted/i,
    );
    assert.match(
      formatClientDeleteFailureMessage({ code: "23503", message: "foreign key violation" }),
      /was not deleted/,
    );
  });
});
