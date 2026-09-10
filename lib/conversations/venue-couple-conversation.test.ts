import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  findOrCreateVenueCoupleConversation,
  findVenueCoupleConversationId,
  VENUE_COUPLE_CONVERSATION_KIND,
} from "@/lib/conversations/venue-couple-conversation";

const REL = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const VENUE = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const COUPLE_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const INQUIRY_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";

type Row = {
  id: string;
  venue_id: string;
  relationship_id: string;
  conversation_kind: string;
};

function mockClient(seed: Row[]) {
  const rows = [...seed];
  let lastInsert: Record<string, unknown> | null = null;

  return {
    rows,
    getLastInsert: () => lastInsert,
    from(_table: string) {
      const filters: Record<string, string> = {};
      const api = {
        select(_cols: string) {
          return {
            eq(col: string, val: string) {
              filters[col] = val;
              return this;
            },
            async maybeSingle() {
              const matches = rows.filter((r) =>
                Object.entries(filters).every(([k, v]) => (r as Record<string, string>)[k] === v),
              );
              if (matches.length > 1) {
                return { data: null, error: { message: "multiple rows", code: "PGRST116" } };
              }
              return { data: matches[0] ?? null, error: null };
            },
            async single() {
              const matches = rows.filter((r) =>
                Object.entries(filters).every(([k, v]) => (r as Record<string, string>)[k] === v),
              );
              return { data: matches[0] ?? null, error: matches[0] ? null : { message: "not found" } };
            },
          };
        },
        insert(row: Record<string, unknown>) {
          lastInsert = row;
          return {
            select(_cols: string) {
              return {
                async single() {
                  const created: Row = {
                    id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
                    venue_id: String(row.venue_id),
                    relationship_id: String(row.relationship_id),
                    conversation_kind: String(row.conversation_kind),
                  };
                  rows.push(created);
                  return { data: created, error: null };
                },
              };
            },
          };
        },
      };
      return api;
    },
  };
}

describe("venue_couple conversation resolution (Track B)", () => {
  it("selects venue_couple when inquiry shares relationship_id", async () => {
    const client = mockClient([
      {
        id: INQUIRY_ID,
        venue_id: VENUE,
        relationship_id: REL,
        conversation_kind: "couple_vendor_inquiry",
      },
      {
        id: COUPLE_ID,
        venue_id: VENUE,
        relationship_id: REL,
        conversation_kind: VENUE_COUPLE_CONVERSATION_KIND,
      },
    ]);

    const id = await findVenueCoupleConversationId(client, REL);
    assert.equal(id, COUPLE_ID);
  });

  it("never returns couple_vendor_inquiry", async () => {
    const client = mockClient([
      {
        id: INQUIRY_ID,
        venue_id: VENUE,
        relationship_id: REL,
        conversation_kind: "couple_vendor_inquiry",
      },
    ]);

    const id = await findVenueCoupleConversationId(client, REL);
    assert.equal(id, null);
  });

  it("creates venue_couple when only inquiry exists", async () => {
    const client = mockClient([
      {
        id: INQUIRY_ID,
        venue_id: VENUE,
        relationship_id: REL,
        conversation_kind: "couple_vendor_inquiry",
      },
    ]);

    const id = await findOrCreateVenueCoupleConversation(client, VENUE, REL);
    assert.ok(id);
    assert.notEqual(id, INQUIRY_ID);
    assert.equal(client.getLastInsert()?.conversation_kind, VENUE_COUPLE_CONVERSATION_KIND);
    assert.equal(client.getLastInsert()?.relationship_id, REL);
  });

  it("reuses existing venue_couple when it is the only conversation", async () => {
    const client = mockClient([
      {
        id: COUPLE_ID,
        venue_id: VENUE,
        relationship_id: REL,
        conversation_kind: VENUE_COUPLE_CONVERSATION_KIND,
      },
    ]);

    const id = await findOrCreateVenueCoupleConversation(client, VENUE, REL);
    assert.equal(id, COUPLE_ID);
    assert.equal(client.getLastInsert(), null);
  });
});

describe("SMS path source locks (Track B)", () => {
  it("inbound, scheduled, and external outbound use venue_couple helper", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const inbound = readFileSync(resolve("app/api/messaging/sms-inbound/route.ts"), "utf8");
    const scheduled = readFileSync(resolve("lib/scheduled-messages/processor.ts"), "utf8");
    const external = readFileSync(resolve("lib/conversations/record-external-outbound.ts"), "utf8");
    const repo = readFileSync(resolve("lib/conversations/repository.ts"), "utf8");

    for (const src of [inbound, scheduled, external]) {
      assert.match(src, /findOrCreateVenueCoupleConversation/);
    }
    assert.match(repo, /findVenueCoupleConversationId/);
    assert.match(inbound, /No match → log and skip/);
    assert.match(inbound, /venue_couple/);
  });
});
