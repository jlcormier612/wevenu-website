import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canAccessDocumentFile,
  documentFileOriginLabel,
  documentSharingDirectionLabel,
  isClientMediaPublicUrl,
  isDocumentsPublicUrl,
  storagePathFromClientMediaUrl,
  storagePathFromDocumentsUrl,
  venueOwnsDocumentsPath,
} from "@/lib/documents/access";
import { parseReplaceDocumentResult, shouldRemoveOrphanUpload } from "@/lib/documents/replace";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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
    assert.equal(isClientMediaPublicUrl("https://x/object/public/client-media/a"), true);
    assert.equal(
      storagePathFromClientMediaUrl(
        "https://x.supabase.co/storage/v1/object/public/client-media/venue-a/c1/doc.png",
      ),
      "venue-a/c1/doc.png",
    );
    assert.equal(venueOwnsDocumentsPath("venue-a", "venue-a/event/x.pdf"), true);
    assert.equal(venueOwnsDocumentsPath("venue-b", "venue-a/event/x.pdf"), false);
  });
});

describe("document file origin label", () => {
  it("labels couple-shared insurance mirrors as Client despite uploaded_by_type=venue", () => {
    assert.equal(
      documentFileOriginLabel({
        uploadedByType: "venue",
        storageUrl: "https://x/object/public/client-media/v/c/coi.png",
        tags: ["couple-shared-insurance"],
      }),
      "Client",
    );
    assert.equal(
      documentFileOriginLabel({
        uploadedByType: "venue",
        storageUrl: "https://x/object/public/documents/v/e/venue.pdf",
      }),
      "Venue",
    );
    assert.equal(documentFileOriginLabel({ uploadedByType: "vendor" }), "Vendor");
  });

  it("sharing direction reflects couple→venue vs venue→couple", () => {
    assert.equal(
      documentSharingDirectionLabel({
        originLabel: "Client",
        isCoupleVisible: false,
        isVendorVisible: false,
      }),
      "Shared by couple",
    );
    assert.equal(
      documentSharingDirectionLabel({
        originLabel: "Venue",
        isCoupleVisible: true,
        isVendorVisible: false,
      }),
      "Shared with couple",
    );
    assert.equal(
      documentSharingDirectionLabel({
        originLabel: "Venue",
        isCoupleVisible: false,
        isVendorVisible: false,
      }),
      "Private",
    );
  });
});

describe("client selections empty copy distinguishes Event Order lines", () => {
  it("empty state does not imply Event Order is empty", () => {
    const src = readFileSync(resolve("components/client-choices/client-choices-panel.tsx"), "utf8");
    assert.match(src, /Venue-authored Event Order lines/);
    assert.match(src, /independent of this panel/);
  });
});

describe("payment plan builder navigation", () => {
  it("new schedule page links back to invoice and event", () => {
    const src = readFileSync(resolve("app/(app)/payments/new/page.tsx"), "utf8");
    assert.match(src, /Back to invoice/);
    assert.match(src, /Event Order/);
    assert.match(src, /review and send from the invoice/);
  });
});

describe("document file routes resolve client-media", () => {
  it("venue/portal/vendor file routes use resolveAuthorizedDocumentFileUrl", () => {
    for (const rel of [
      "app/api/documents/[id]/file/route.ts",
      "app/api/portal/documents/[id]/file/route.ts",
      "app/api/vendor/documents/[id]/file/route.ts",
    ]) {
      const src = readFileSync(resolve(rel), "utf8");
      assert.match(src, /resolveAuthorizedDocumentFileUrl/);
      assert.doesNotMatch(src, /createDocumentsSignedUrl\(row\.storagePath\)/);
    }
  });

  it("signed-url helper falls back to client-media after documents miss", () => {
    const src = readFileSync(resolve("lib/documents/signed-url.ts"), "utf8");
    assert.match(src, /export async function resolveAuthorizedDocumentFileUrl/);
    assert.match(src, /CLIENT_MEDIA_BUCKET/);
    assert.match(src, /createDocumentsSignedUrl/);
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
