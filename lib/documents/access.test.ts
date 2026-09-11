import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canAccessDocumentFile,
  isDocumentsPublicUrl,
  storagePathFromDocumentsUrl,
  venueOwnsDocumentsPath,
} from "@/lib/documents/access";
import { parseReplaceDocumentResult, shouldRemoveOrphanUpload } from "@/lib/documents/replace";

const row = {
  id: "doc-1",
  venueId: "venue-a",
  clientId: "client-1",
  eventId: "event-1",
  storagePath: "venue-a/event/event-1/doc-1.pdf",
  isCoupleVisible: true,
  sharedWithVendors: true,
};

describe("documents storage path helpers", () => {
  it("extracts object path from public and signed URLs", () => {
    assert.equal(
      storagePathFromDocumentsUrl("https://x.supabase.co/storage/v1/object/public/documents/venue-a/a.pdf"),
      "venue-a/a.pdf",
    );
    assert.equal(
      storagePathFromDocumentsUrl("https://x.supabase.co/storage/v1/object/sign/documents/venue-a/a.pdf?token=1"),
      "venue-a/a.pdf",
    );
    assert.equal(isDocumentsPublicUrl("https://x/object/public/documents/a"), true);
    assert.equal(isDocumentsPublicUrl("https://x/object/public/client-media/a"), false);
    assert.equal(venueOwnsDocumentsPath("venue-a", "venue-a/event/x.pdf"), true);
    assert.equal(venueOwnsDocumentsPath("venue-b", "venue-a/event/x.pdf"), false);
  });
});

describe("document file access matrix", () => {
  it("venue staff of the owning venue can read", () => {
    assert.equal(canAccessDocumentFile({ kind: "venue", venueId: "venue-a" }, row), true);
    assert.equal(canAccessDocumentFile({ kind: "venue", venueId: "venue-b" }, row), false);
  });

  it("couple can read only shared files for their client/event", () => {
    assert.equal(
      canAccessDocumentFile(
        { kind: "couple", venueId: "venue-a", clientId: "client-1", eventId: "event-1" },
        row,
      ),
      true,
    );
    assert.equal(
      canAccessDocumentFile(
        { kind: "couple", venueId: "venue-a", clientId: "other", eventId: "other-event" },
        { ...row, isCoupleVisible: true },
      ),
      false,
    );
    assert.equal(
      canAccessDocumentFile(
        { kind: "couple", venueId: "venue-a", clientId: "client-1", eventId: "event-1" },
        { ...row, isCoupleVisible: false },
      ),
      false,
    );
  });

  it("vendor can read only shared event files they are assigned to", () => {
    assert.equal(
      canAccessDocumentFile({ kind: "vendor", vendorId: "vnd", eventIds: ["event-1"] }, row),
      true,
    );
    assert.equal(
      canAccessDocumentFile({ kind: "vendor", vendorId: "vnd", eventIds: ["event-9"] }, row),
      false,
    );
    assert.equal(
      canAccessDocumentFile(
        { kind: "vendor", vendorId: "vnd", eventIds: ["event-1"] },
        { ...row, sharedWithVendors: false },
      ),
      false,
    );
  });

  it("blocks empty storage paths", () => {
    assert.equal(
      canAccessDocumentFile({ kind: "venue", venueId: "venue-a" }, { ...row, storagePath: "" }),
      false,
    );
  });
});

describe("replace document result parsing", () => {
  it("parses success and failure and flags orphan cleanup", () => {
    const ok = parseReplaceDocumentResult({ ok: true, documentId: "d1", version: 2, archivedVersion: 1 });
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.version, 2);
    const fail = parseReplaceDocumentResult({ ok: false, reason: "not_found" });
    assert.equal(fail.ok, false);
    assert.equal(shouldRemoveOrphanUpload(fail), true);
    const denied = parseReplaceDocumentResult({ ok: false, reason: "unauthorized" });
    assert.equal(shouldRemoveOrphanUpload(denied), false);
  });
});
