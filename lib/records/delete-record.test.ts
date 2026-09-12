import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const svc = readFileSync(resolve("lib/records/delete-record.ts"), "utf8");
const leadDetail = readFileSync(resolve("components/leads/lead-detail.tsx"), "utf8");
const clientPage = readFileSync(resolve("app/(app)/clients/[id]/page.tsx"), "utf8");
const dialog = readFileSync(resolve("components/records/delete-record-button.tsx"), "utf8");

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
