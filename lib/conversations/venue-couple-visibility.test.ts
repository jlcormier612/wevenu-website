import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

/**
 * Venue ↔ couple conversation visibility contract.
 *
 * Human E2E confusion: Cuppity Cakes vendor Messages shows
 * "Talking to Jen's Fancy Venue" / "The couple cannot see this thread"
 * on an empty venue_vendor pairwise thread. That is intentional and must
 * NOT be confused with the couple↔venue venue_couple conversation that
 * holds portal/email/SMS history.
 */
const REPO = resolve("lib/conversations/repository.ts");
const CLIENT_PAGE = resolve("app/(app)/clients/[id]/page.tsx");
const EVENT_DETAIL = resolve("components/events/event-detail.tsx");
const REL_TAB = resolve("components/conversations/relationship-conversation-tab.tsx");
const VENDOR_THREAD = resolve("components/vendor-app/vendor-conversation-thread.tsx");
const VENDOR_EVENT = resolve("components/vendor-app/vendor-event-workspace.tsx");
const VENUE_COUPLE = resolve("lib/conversations/venue-couple-conversation.ts");
const PORTAL_MIG = resolve(
  "supabase/migrations/20261391000000_portal_venue_couple_channel.sql",
);
const INBOUND = resolve("app/api/messaging/inbound/route.ts");
const SMS_INBOUND = resolve("app/api/messaging/sms-inbound/route.ts");
const PORTAL_UI = resolve("components/portal/message-section.tsx");

describe("venue CRM Conversation resolves venue_couple (same as portal)", () => {
  it("getConversationIdForRelationship uses findVenueCoupleConversationId", () => {
    const src = readFileSync(REPO, "utf8");
    const fn = src.slice(src.indexOf("export async function getConversationIdForRelationship"));
    const body = fn.slice(0, 400);
    assert.match(body, /findVenueCoupleConversationId/);
    assert.doesNotMatch(body, /\.eq\("relationship_id".*\)\s*\.maybeSingle\(\)/s);
  });

  it("client EventDetail Conversation tab is wired via getConversationIdForRelationship", () => {
    const page = readFileSync(CLIENT_PAGE, "utf8");
    assert.match(page, /getConversationIdForRelationship/);
    assert.match(page, /conversationId=\{conversationId\}/);
    assert.match(page, /EventDetail/);
  });

  it("event Messages tab renders RelationshipConversationTab with that conversationId", () => {
    const detail = readFileSync(EVENT_DETAIL, "utf8");
    const messagesTab = detail.slice(detail.indexOf('TabsContent value="messages"'));
    assert.match(messagesTab.slice(0, 400), /RelationshipConversationTab/);
    assert.match(messagesTab.slice(0, 400), /conversationId=\{conversationId\}/);
    assert.doesNotMatch(messagesTab.slice(0, 800), /VendorConversationThread|Talking to/);
  });

  it("RelationshipConversationTab embeds ConversationThread (venue Inbox component), not vendor pairwise UI", () => {
    const tab = readFileSync(REL_TAB, "utf8");
    assert.match(tab, /ConversationThread/);
    assert.doesNotMatch(tab, /VendorConversationThread|cannot see this thread/);
  });
});

describe("vendor pairwise threads stay distinct from venue_couple", () => {
  it("only VendorConversationThread shows Talking to / cannot see this thread", () => {
    const vendor = readFileSync(VENDOR_THREAD, "utf8");
    assert.match(vendor, /Talking to \{recipientName\}/);
    assert.match(vendor, /cannot see this thread/);

    const venueThread = readFileSync(
      resolve("components/conversations/conversation-thread.tsx"),
      "utf8",
    );
    assert.doesNotMatch(venueThread, /Talking to/);
    assert.doesNotMatch(venueThread, /cannot see this thread/);
  });

  it("vendor event MessagesTab defaults to venue_vendor (not venue_couple / not inquiry)", () => {
    const src = readFileSync(VENDOR_EVENT, "utf8");
    const tab = src.slice(src.indexOf("function MessagesTab"));
    assert.match(tab, /conversationKind === "venue_vendor"/);
    assert.match(tab, /conversationKind === "couple_vendor"/);
    assert.doesNotMatch(tab.slice(0, 2000), /venue_couple/);
  });

  it("findOrCreateVenueCoupleConversation never returns inquiry/vendor kinds", () => {
    const src = readFileSync(VENUE_COUPLE, "utf8");
    assert.match(src, /VENUE_COUPLE_CONVERSATION_KIND = "venue_couple"/);
    assert.match(src, /conversation_kind.*VENUE_COUPLE_CONVERSATION_KIND|eq\("conversation_kind"/);
  });
});

describe("portal / inbound stay on venue_couple", () => {
  it("portal RPCs require conversation_kind = venue_couple", () => {
    const sql = readFileSync(PORTAL_MIG, "utf8");
    assert.match(sql, /get_portal_conversation/);
    assert.match(sql, /conversation_kind = 'venue_couple'/);
    assert.match(sql, /send_portal_conversation_message/);
  });

  it("inbound email relationship fallback and SMS inbound use venue_couple", () => {
    const email = readFileSync(INBOUND, "utf8");
    assert.match(email, /conversation_kind/);
    assert.match(email, /venue_couple/);
    const sms = readFileSync(SMS_INBOUND, "utf8");
    assert.match(sms, /findOrCreateVenueCoupleConversation/);
  });

  it("portal Messages UI preserves channel labels", () => {
    const ui = readFileSync(PORTAL_UI, "utf8");
    assert.match(ui, /clientHistoryChannelLabel/);
  });
});
