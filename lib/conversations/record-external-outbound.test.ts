import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { recordExternalClientOutbound } from "@/lib/conversations/record-external-outbound";

function mockClient(opts: {
  relationshipId?: string | null;
  conversationId?: string;
  insertError?: string | null;
}) {
  const inserts: Record<string, unknown>[] = [];
  const supabase = {
    from(table: string) {
      if (table === "clients") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: opts.relationshipId ? { relationship_id: opts.relationshipId } : null,
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
                data: opts.conversationId ? { id: opts.conversationId } : null,
              }),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: async () => ({ data: { id: "conv-new" }, error: null }),
            }),
          }),
        };
      }
      if (table === "conversation_messages") {
        return {
          insert: (row: Record<string, unknown>) => {
            inserts.push(row);
            return {
              select: () => ({
                single: async () =>
                  opts.insertError
                    ? { data: null, error: { message: opts.insertError } }
                    : { data: { id: "msg-1" }, error: null },
              }),
            };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  return { supabase, inserts };
}

describe("recordExternalClientOutbound", () => {
  it("writes system email into conversation_messages with source metadata", async () => {
    const { supabase, inserts } = mockClient({
      relationshipId: "rel-1",
      conversationId: "conv-1",
    });
    const result = await recordExternalClientOutbound(supabase, {
      venueId: "venue-1",
      clientId: "client-1",
      channel: "email",
      body: "Payment reminder body",
      providerId: "re_123",
      sourceType: "payment_reminder",
      sourceId: "reminder-1",
    });
    assert.equal(result.ok, true);
    assert.equal(inserts.length, 1);
    assert.equal(inserts[0].sender_type, "system");
    assert.equal(inserts[0].channel, "email");
    assert.equal(inserts[0].body, "Payment reminder body");
    assert.deepEqual(inserts[0].channel_metadata, {
      sourceType: "payment_reminder",
      sourceId: "reminder-1",
      automated: true,
    });
  });

  it("skips when no relationship can be resolved", async () => {
    const { supabase, inserts } = mockClient({ relationshipId: null });
    const result = await recordExternalClientOutbound(supabase, {
      venueId: "venue-1",
      clientId: "client-missing",
      channel: "email",
      body: "Hi",
      sourceType: "payment_reminder",
      sourceId: "r1",
    });
    assert.equal(result.ok, false);
    assert.equal(result.skipped, "no_relationship");
    assert.equal(inserts.length, 0);
  });
});
