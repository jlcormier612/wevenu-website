import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  clientHistoryChannelLabel,
  isOutboundChannel,
} from "@/lib/conversations/channels";
import {
  extractConversationIdFromTo,
  resolveInboundEmailConversation,
  type InboundEmailStore,
} from "@/lib/conversations/inbound-email";

const MIGRATION = resolve(
  "supabase/migrations/20261391000000_portal_venue_couple_channel.sql",
);
const INBOUND_ROUTE = resolve("app/api/messaging/inbound/route.ts");
const SMS_INBOUND = resolve("app/api/messaging/sms-inbound/route.ts");
const PORTAL_API = resolve("app/api/portal/messages/route.ts");
const PORTAL_UI = resolve("components/portal/message-section.tsx");
const REPO = resolve("lib/conversations/repository.ts");

const VENUE_COUPLE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const INQUIRY_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("portal venue_couple routing (migration)", () => {
  const sql = readFileSync(MIGRATION, "utf8");

  it("get_portal_conversation requires conversation_kind = venue_couple", () => {
    const fn = sql.slice(sql.indexOf("create or replace function public.get_portal_conversation"));
    const body = fn.slice(0, fn.indexOf("create or replace function public.send_portal_conversation_message"));
    assert.match(body, /conversation_kind = 'venue_couple'/);
    assert.match(body, /relationship_id = v_relationship_id/);
    assert.doesNotMatch(
      body.replace(/conversation_kind = 'venue_couple'/g, ""),
      /from public\.conversations\s+where relationship_id = v_relationship_id\s*;/,
    );
  });

  it("send_portal_conversation_message requires conversation_kind = venue_couple", () => {
    const fn = sql.slice(sql.indexOf("create or replace function public.send_portal_conversation_message"));
    assert.match(fn, /conversation_kind = 'venue_couple'/);
    assert.match(fn, /channel.*'portal'|values \(v_conversation_id, v_venue_id, 'lead_or_client', 'portal'/);
  });

  it("get_portal_conversation returns message channel for mixed-channel history", () => {
    const fn = sql.slice(sql.indexOf("create or replace function public.get_portal_conversation"));
    const body = fn.slice(0, fn.indexOf("create or replace function public.send_portal_conversation_message"));
    assert.match(body, /'channel', cm\.channel/);
  });

  it("portal RPCs still exclude staff-only channels from couple history", () => {
    assert.match(sql, /channel not in \('internal_note', 'phone_log', 'voicemail', 'push'\)/);
  });
});

describe("email relationship fallback venue_couple", () => {
  it("inbound route scopes findConversationForRelationship to venue_couple", () => {
    const src = readFileSync(INBOUND_ROUTE, "utf8");
    const start = src.indexOf("async findConversationForRelationship");
    assert.ok(start > 0);
    const block = src.slice(start, start + 500);
    assert.match(block, /conversation_kind/);
    assert.match(block, /venue_couple/);
    assert.match(block, /relationship_id/);
  });

  it("fallback match uses store relationship lookup (venue_couple only in production store)", async () => {
    const venueCouple = {
      id: VENUE_COUPLE_ID,
      venue_id: "venue-1",
      relationship_id: "rel-1",
    };
    const calls: string[] = [];
    const store: InboundEmailStore = {
      findConversationById: async () => null,
      findConversationMessageByProviderId: async () => null,
      findLegacyMessageByProviderId: async () => null,
      findLegacyThread: async () => null,
      findLeadByEmail: async (email) =>
        email === "emma@example.com"
          ? { id: "lead-1", venue_id: "venue-1", relationship_id: "rel-1" }
          : null,
      findClientByEmail: async () => null,
      findConversationForRelationship: async (relationshipId) => {
        calls.push(relationshipId);
        // Production store returns venue_couple only — never inquiry.
        assert.equal(relationshipId, "rel-1");
        return venueCouple;
      },
      findConversationForLead: async () => null,
      findConversationForClient: async () => null,
    };

    const match = await resolveInboundEmailConversation(store, {
      toAddresses: ["inbox@replies.hellotocheers.com"],
      inReplyTo: null,
      fromEmail: "emma@example.com",
    });

    assert.equal(match?.conversationId, VENUE_COUPLE_ID);
    assert.notEqual(match?.conversationId, INQUIRY_ID);
    assert.deepEqual(calls, ["rel-1"]);
  });

  it("primary thread+{conversationId} routing remains intact", () => {
    assert.equal(
      extractConversationIdFromTo([`thread+${VENUE_COUPLE_ID}@replies.hellotocheers.com`]),
      VENUE_COUPLE_ID,
    );
  });
});

describe("portal channel visibility mapping", () => {
  it("repository maps channel from portal RPC payload", () => {
    const src = readFileSync(REPO, "utf8");
    const fn = src.slice(src.indexOf("export async function getPortalConversation"));
    const body = fn.slice(0, fn.indexOf("export async function sendPortalConversationMessage"));
    assert.match(body, /channel:/);
    assert.match(body, /m\.channel/);
  });

  it("portal messages API preserves channel through toLegacyMessage", () => {
    const src = readFileSync(PORTAL_API, "utf8");
    assert.match(src, /channel: m\.channel/);
  });

  it("portal Messages UI labels history channels", () => {
    const src = readFileSync(PORTAL_UI, "utf8");
    assert.match(src, /clientHistoryChannelLabel/);
    assert.doesNotMatch(src, /channel:\s*"email".*fetch\("\/api\/portal\/messages"/s);
  });

  it("clientHistoryChannelLabel distinguishes portal / email / sms", () => {
    assert.equal(clientHistoryChannelLabel("portal"), "Portal");
    assert.equal(clientHistoryChannelLabel("email"), "Email");
    assert.equal(clientHistoryChannelLabel("sms"), "Text");
    assert.equal(clientHistoryChannelLabel("internal_note"), null);
    assert.equal(isOutboundChannel("email"), true);
  });
});

describe("SMS inbound venue_couple association unchanged", () => {
  it("sms-inbound still uses findOrCreateVenueCoupleConversation", () => {
    const src = readFileSync(SMS_INBOUND, "utf8");
    assert.match(src, /findOrCreateVenueCoupleConversation/);
    assert.match(src, /find_relationship_by_phone_for_venue/);
  });
});
