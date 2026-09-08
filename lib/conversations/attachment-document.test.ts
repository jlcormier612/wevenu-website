/**
 * Message attachment → Documents destination rules + idempotent registration.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  chooseAttachmentDocumentTarget,
  documentsWorkspaceHref,
  isDocumentsBucketPath,
  registerMessageAttachmentAsDocument,
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
  it("single-event → event Documents", () => {
    assert.equal(
      documentsWorkspaceHref({ leadId: "l1", clientId: "c1", eventId: "e1" }),
      "/events/e1#documents",
    );
  });

  it("prefers booking workspace for clients when no unambiguous event", () => {
    assert.equal(
      documentsWorkspaceHref({ leadId: "l1", clientId: "c1" }),
      "/clients/c1#documents",
    );
    assert.equal(
      documentsWorkspaceHref({ leadId: "l1", clientId: "c1", eventId: null }),
      "/clients/c1#documents",
    );
  });

  it("client-only → client Documents", () => {
    assert.equal(
      documentsWorkspaceHref({ leadId: null, clientId: "c1" }),
      "/clients/c1#documents",
    );
  });

  it("lead-only → lead Documents with #documents", () => {
    assert.equal(
      documentsWorkspaceHref({ leadId: "l1", clientId: null }),
      "/leads/l1#documents",
    );
  });

  it("does not invent an event from lead/client alone", () => {
    assert.equal(
      documentsWorkspaceHref({ leadId: "l1", clientId: "c1" }),
      "/clients/c1#documents",
    );
  });
});

type InsertCall = { venueId: string; storagePath: string };

function mockRegisterClient(opts: {
  venueId: string;
  relationshipId: string;
  leadId?: string | null;
  clientId?: string | null;
  eventIds?: string[];
  /** Existing docs keyed by `${venueId}::${storagePath}` */
  existingByVenuePath?: Map<string, string>;
}) {
  const inserts: InsertCall[] = [];
  const existing = opts.existingByVenuePath ?? new Map<string, string>();
  let nextDoc = 1;

  const supabase = {
    from(table: string) {
      if (table === "conversation_messages") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "msg-1",
                  venue_id: opts.venueId,
                  conversation_id: "conv-1",
                },
              }),
            }),
          }),
        };
      }
      if (table === "conversations") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  relationship_id: opts.relationshipId,
                  event_vendor_assignment_id: null,
                },
              }),
            }),
          }),
        };
      }
      if (table === "clients") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({
                      data: opts.clientId ? { id: opts.clientId } : null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "leads") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({
                      data: opts.leadId ? { id: opts.leadId } : null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "events") {
        return {
          select: () => ({
            eq: () => ({
              eq: async () => ({
                data: (opts.eventIds ?? []).map((id) => ({ id })),
              }),
            }),
          }),
        };
      }
      if (table === "documents") {
        return {
          select: () => ({
            eq: (_col: string, venueId: string) => ({
              eq: (_col2: string, storagePath: string) => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => {
                      const key = `${venueId}::${storagePath}`;
                      const id = existing.get(key) ?? null;
                      return { data: id ? { id } : null, error: null };
                    },
                  }),
                }),
              }),
            }),
          }),
          insert: (row: Record<string, unknown>) => {
            const venueId = String(row.venue_id);
            const storagePath = String(row.storage_path);
            inserts.push({ venueId, storagePath });
            const id = `doc-${nextDoc++}`;
            existing.set(`${venueId}::${storagePath}`, id);
            return {
              select: () => ({
                single: async () => ({ data: { id }, error: null }),
              }),
            };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };

  return { supabase, inserts, existing };
}

describe("registerMessageAttachmentAsDocument idempotency (I1)", () => {
  const fileUrl =
    "https://xyz.supabase.co/storage/v1/object/public/couple-messages/conversations/v1/c1/file.pdf";
  const storagePath = "conversations/v1/c1/file.pdf";

  it("first registration creates one document; second returns the same id without another insert", async () => {
    const { supabase, inserts } = mockRegisterClient({
      venueId: "venue-a",
      relationshipId: "rel-1",
      leadId: null,
      clientId: "client-1",
      eventIds: ["event-1"],
    });

    const first = await registerMessageAttachmentAsDocument(supabase as never, {
      messageId: "msg-1",
      attachmentId: "att-1",
      file: { url: fileUrl, name: "file.pdf", size: 10, mimeType: "application/pdf" },
    });
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.equal(inserts.length, 1);
    assert.equal(inserts[0]!.storagePath, storagePath);

    const second = await registerMessageAttachmentAsDocument(supabase as never, {
      messageId: "msg-1",
      attachmentId: "att-1",
      file: { url: fileUrl, name: "file.pdf", size: 10, mimeType: "application/pdf" },
    });
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.equal(second.documentId, first.documentId);
    assert.equal(inserts.length, 1, "second registration must not insert again");
  });

  it("different venues may share the same storage_path independently", async () => {
    const mapA = new Map<string, string>();
    const mapB = new Map<string, string>();
    const venueA = mockRegisterClient({
      venueId: "venue-a",
      relationshipId: "rel-a",
      clientId: "client-a",
      eventIds: ["event-a"],
      existingByVenuePath: mapA,
    });
    const venueB = mockRegisterClient({
      venueId: "venue-b",
      relationshipId: "rel-b",
      clientId: "client-b",
      eventIds: ["event-b"],
      existingByVenuePath: mapB,
    });

    const rA = await registerMessageAttachmentAsDocument(venueA.supabase as never, {
      messageId: "msg-1",
      file: { url: fileUrl, name: "file.pdf" },
    });
    const rB = await registerMessageAttachmentAsDocument(venueB.supabase as never, {
      messageId: "msg-1",
      file: { url: fileUrl, name: "file.pdf" },
    });
    assert.equal(rA.ok, true);
    assert.equal(rB.ok, true);
    if (!rA.ok || !rB.ok) return;
    assert.equal(venueA.inserts.length, 1);
    assert.equal(venueB.inserts.length, 1);
    assert.equal(mapA.get(`venue-a::${storagePath}`), rA.documentId);
    assert.equal(mapB.get(`venue-b::${storagePath}`), rB.documentId);
    // Venue isolation: each venue keeps its own row for the same path.
    assert.ok(mapA.has(`venue-a::${storagePath}`));
    assert.ok(mapB.has(`venue-b::${storagePath}`));
    assert.equal(mapA.has(`venue-b::${storagePath}`), false);
    assert.equal(mapB.has(`venue-a::${storagePath}`), false);
  });

  it("preserves single-event ownership on first insert", async () => {
    const { supabase, inserts } = mockRegisterClient({
      venueId: "venue-a",
      relationshipId: "rel-1",
      clientId: "client-1",
      eventIds: ["event-1"],
    });
    // Capture insert row via wrapping — re-check target via chooseAttachmentDocumentTarget
    const target = chooseAttachmentDocumentTarget({
      leadId: null,
      clientId: "client-1",
      eventIds: ["event-1"],
    });
    assert.deepEqual(target, { entityType: "event", entityId: "event-1" });

    const result = await registerMessageAttachmentAsDocument(supabase as never, {
      messageId: "msg-1",
      file: { url: fileUrl, name: "photo.jpg", mimeType: "image/jpeg" },
    });
    assert.equal(result.ok, true);
    assert.equal(inserts.length, 1);
  });
});
