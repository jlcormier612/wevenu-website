/**
 * Message attachment → Documents destination rules.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  chooseAttachmentDocumentTarget,
  documentsWorkspaceHref,
  isDocumentsBucketPath,
  storagePathFromPublicUrl,
} from "@/lib/conversations/attachment-document";

describe("chooseAttachmentDocumentTarget", () => {
  it("lead only → lead Documents", () => {
    assert.deepEqual(
      chooseAttachmentDocumentTarget({ leadId: "lead-1", clientId: null, eventIds: [] }),
      { entityType: "lead", entityId: "lead-1" },
    );
  });

  it("client + exactly one event → event Documents (Booking workspace)", () => {
    assert.deepEqual(
      chooseAttachmentDocumentTarget({
        leadId: "lead-1",
        clientId: "client-1",
        eventIds: ["event-1"],
      }),
      { entityType: "event", entityId: "event-1" },
    );
  });

  it("client + no event → client Documents", () => {
    assert.deepEqual(
      chooseAttachmentDocumentTarget({ leadId: null, clientId: "client-1", eventIds: [] }),
      { entityType: "client", entityId: "client-1" },
    );
  });

  it("client + multiple events → client only (no earliest-event inventing)", () => {
    assert.deepEqual(
      chooseAttachmentDocumentTarget({
        leadId: null,
        clientId: "client-1",
        eventIds: ["event-a", "event-b"],
      }),
      { entityType: "client", entityId: "client-1" },
    );
  });

  it("no lead/client → null (e.g. vendor conversation)", () => {
    assert.equal(
      chooseAttachmentDocumentTarget({ leadId: null, clientId: null, eventIds: ["event-1"] }),
      null,
    );
  });
});

describe("storage path helpers", () => {
  it("extracts couple-messages path from public URL", () => {
    const url =
      "https://xyz.supabase.co/storage/v1/object/public/couple-messages/conversations/v1/c1/file.pdf";
    assert.equal(storagePathFromPublicUrl(url), "conversations/v1/c1/file.pdf");
    assert.equal(isDocumentsBucketPath("conversations/v1/c1/file.pdf"), false);
  });

  it("documents bucket paths remain deletable from documents storage", () => {
    assert.equal(isDocumentsBucketPath("venue/lead/id/doc.pdf"), true);
  });
});

describe("documentsWorkspaceHref", () => {
  it("prefers booking workspace for clients", () => {
    assert.equal(
      documentsWorkspaceHref({ leadId: "l1", clientId: "c1" }),
      "/clients/c1#documents",
    );
  });

  it("uses lead record when no client", () => {
    assert.equal(documentsWorkspaceHref({ leadId: "l1", clientId: null }), "/leads/l1");
  });
});
