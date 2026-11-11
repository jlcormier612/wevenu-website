import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyQrCampaignStatus,
  interpretQrCampaignUpdate,
  resolveArchiveToggle,
} from "@/lib/qr-campaigns/archive-ui-state";
import type { QrCampaign } from "@/lib/qr-campaigns/types";

function campaign(
  partial: Partial<QrCampaign> & Pick<QrCampaign, "id" | "name" | "status">,
): QrCampaign {
  return {
    venueId: "venue-1",
    code: "abc123",
    destinationType: "inquiry_form",
    destinationUrl: null,
    publicFormId: null,
    sourceMasterKey: null,
    createdAt: "2026-09-21T00:00:00.000Z",
    ...partial,
  };
}

describe("QR campaign archive UI state", () => {
  const activeA = campaign({ id: "a", name: "Active A", status: "active" });
  const activeB = campaign({ id: "b", name: "Active B", status: "active" });
  const archivedC = campaign({ id: "c", name: "Archived C", status: "archived" });

  it("archive success moves the campaign out of active into archived", () => {
    const list = [activeA, activeB, archivedC];
    const outcome = resolveArchiveToggle(list, "a", "archived", { ok: true });
    assert.equal(outcome.kind, "success");
    assert.equal(outcome.message, "Campaign archived");
    assert.deepEqual(
      outcome.campaigns.filter((c) => c.status === "active").map((c) => c.id),
      ["b"],
    );
    assert.deepEqual(
      outcome.campaigns.filter((c) => c.status === "archived").map((c) => c.id),
      ["a", "c"],
    );
  });

  it("reactivate success moves the campaign out of archived into active", () => {
    const list = [activeB, archivedC];
    const outcome = resolveArchiveToggle(list, "c", "active", { ok: true });
    assert.equal(outcome.kind, "success");
    assert.equal(outcome.message, "Campaign reactivated");
    assert.deepEqual(
      outcome.campaigns.filter((c) => c.status === "active").map((c) => c.id),
      ["b", "c"],
    );
    assert.deepEqual(
      outcome.campaigns.filter((c) => c.status === "archived").map((c) => c.id),
      [],
    );
  });

  it("failed archive/reactivate preserves existing state and surfaces the error", () => {
    const list = [activeA, archivedC];
    const archiveFail = resolveArchiveToggle(list, "a", "archived", {
      ok: false,
      message: "Session expired.",
    });
    assert.equal(archiveFail.kind, "error");
    assert.equal(archiveFail.message, "Session expired.");
    assert.equal(archiveFail.campaigns, list);
    assert.equal(archiveFail.campaigns[0]?.status, "active");

    const reactivateFail = resolveArchiveToggle(list, "c", "active", { ok: false });
    assert.equal(reactivateFail.kind, "error");
    assert.equal(reactivateFail.message, "Could not update campaign.");
    assert.equal(reactivateFail.campaigns, list);
    assert.equal(reactivateFail.campaigns[1]?.status, "archived");
  });

  it("applyQrCampaignStatus only mutates the matching row", () => {
    const next = applyQrCampaignStatus([activeA, activeB], "b", "archived");
    assert.equal(next[0]?.status, "active");
    assert.equal(next[1]?.status, "archived");
  });
});

describe("interpretQrCampaignUpdate", () => {
  it("treats a zero-row update as failure", () => {
    assert.deepEqual(interpretQrCampaignUpdate(null, []), {
      ok: false,
      message: "This campaign couldn't be updated.",
    });
    assert.deepEqual(interpretQrCampaignUpdate(null, null), {
      ok: false,
      message: "This campaign couldn't be updated.",
    });
  });

  it("treats a successful row update as ok", () => {
    assert.deepEqual(interpretQrCampaignUpdate(null, [{ id: "a" }]), { ok: true });
  });

  it("surfaces supabase errors as failure", () => {
    assert.deepEqual(interpretQrCampaignUpdate({ message: "boom" }, [{ id: "a" }]), {
      ok: false,
      message: "Could not update campaign.",
    });
  });
});
