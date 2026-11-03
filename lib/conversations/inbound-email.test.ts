import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  extractConversationIdFromTo,
  parseFromEmail,
  providerIdFromInReplyTo,
  recordInboundConversationEmail,
  resolveInboundEmailConversation,
  stripEmailReplyQuotes,
  type InboundEmailRecorder,
  type InboundEmailStore,
} from "@/lib/conversations/inbound-email";

const CONVERSATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LEGACY_THREAD_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROVIDER_ID = "re_outbound_1";

function store(overrides: Partial<InboundEmailStore> = {}): InboundEmailStore {
  const conversation = {
    id: CONVERSATION_ID,
    venue_id: "venue-1",
    relationship_id: "rel-1",
  };
  const base: InboundEmailStore = {
    findConversationById: async (id) => (id === CONVERSATION_ID ? conversation : null),
    findConversationMessageByProviderId: async () => null,
    findLegacyMessageByProviderId: async () => null,
    findLegacyThread: async () => null,
    findLeadByEmail: async () => null,
    findClientByEmail: async () => null,
    findConversationForRelationship: async (relationshipId) =>
      relationshipId === "rel-1" ? conversation : null,
    findConversationForLead: async () => conversation,
    findConversationForClient: async () => conversation,
  };
  return { ...base, ...overrides };
}

describe("inbound email thread matching", () => {
  it("extracts the conversation id from Reply-To subaddressing", () => {
    assert.equal(
      extractConversationIdFromTo([`thread+${CONVERSATION_ID}@replies.hellotocheers.com`]),
      CONVERSATION_ID,
    );
    assert.equal(extractConversationIdFromTo(["inbox@replies.hellotocheers.com"]), null);
    assert.equal(providerIdFromInReplyTo("<re_outbound_1@resend.dev>"), "re_outbound_1");
  });

  it("parses a named From header", () => {
    assert.deepEqual(parseFromEmail("Emma Stone <emma@example.com>"), {
      name: "Emma Stone",
      email: "emma@example.com",
    });
  });

  it("matches a reply to a Conversation composer send via thread+{conversationId}", async () => {
    const match = await resolveInboundEmailConversation(store(), {
      toAddresses: [`thread+${CONVERSATION_ID}@replies.hellotocheers.com`],
      inReplyTo: null,
      fromEmail: "emma@example.com",
    });
    assert.deepEqual(match, {
      conversationId: CONVERSATION_ID,
      venueId: "venue-1",
      relationshipId: "rel-1",
      entityType: null,
      entityId: null,
    });
  });

  it("matches In-Reply-To against conversation_messages.provider_id, not the legacy messages table", async () => {
    const match = await resolveInboundEmailConversation(
      store({
        findConversationMessageByProviderId: async (id) =>
          id === PROVIDER_ID ? { conversation_id: CONVERSATION_ID } : null,
        findLegacyMessageByProviderId: async () => {
          throw new Error("legacy messages table must not be the primary match");
        },
      }),
      {
        toAddresses: ["inbox@replies.hellotocheers.com"],
        inReplyTo: `<${PROVIDER_ID}@resend.dev>`,
        fromEmail: "emma@example.com",
      },
    );
    assert.equal(match?.conversationId, CONVERSATION_ID);
  });

  it("can recover a current conversation from a legacy thread id still present in Reply-To", async () => {
    const match = await resolveInboundEmailConversation(
      store({
        findConversationById: async () => null,
        findLegacyThread: async (id) =>
          id === LEGACY_THREAD_ID
            ? { venue_id: "venue-1", lead_id: "lead-1", client_id: null }
            : null,
      }),
      {
        toAddresses: [`thread+${LEGACY_THREAD_ID}@replies.hellotocheers.com`],
        inReplyTo: null,
        fromEmail: "emma@example.com",
      },
    );
    assert.equal(match?.conversationId, CONVERSATION_ID);
    assert.equal(match?.entityType, "lead");
    assert.equal(match?.entityId, "lead-1");
  });

  it("does not pick a conversation when the email matches more than one customer", async () => {
    const match = await resolveInboundEmailConversation(
      store({
        findLeadByEmail: async () => null,
        findClientByEmail: async () => null,
      }),
      {
        toAddresses: ["inbox@replies.hellotocheers.com"],
        inReplyTo: null,
        fromEmail: "shared@example.com",
      },
    );
    assert.equal(match, null);
  });
});

describe("inbound email records into conversation_messages", () => {
  it("inserts the reply on the matched conversation and marks the outbound email replied", async () => {
    const inserted: unknown[] = [];
    const replied: string[] = [];
    const events: string[] = [];
    const recorder: InboundEmailRecorder = {
      insertConversationMessage: async (row) => {
        inserted.push(row);
        return { ok: true };
      },
      findLatestOutboundEmail: async () => ({ id: "msg-out", status: "delivered" }),
      markMessageReplied: async (id) => {
        replied.push(id);
      },
      logRepliedEvent: async (id) => {
        events.push(id);
      },
    };

    const result = await recordInboundConversationEmail(
      recorder,
      {
        conversationId: CONVERSATION_ID,
        venueId: "venue-1",
        relationshipId: "rel-1",
        entityType: "lead",
        entityId: "lead-1",
      },
      "We can do Saturday.",
    );

    assert.deepEqual(result, { ok: true });
    assert.deepEqual(inserted, [{
      conversation_id: CONVERSATION_ID,
      venue_id: "venue-1",
      sender_type: "lead_or_client",
      channel: "email",
      body: "We can do Saturday.",
      status: "received",
    }]);
    assert.deepEqual(replied, ["msg-out"]);
    assert.deepEqual(events, ["msg-out"]);
  });

  it("strips Apple Mail reply quotes before storing so notification previews stay clean", async () => {
    const inserted: Array<{ body: string }> = [];
    const recorder: InboundEmailRecorder = {
      insertConversationMessage: async (row) => {
        inserted.push(row);
        return { ok: true };
      },
      findLatestOutboundEmail: async () => null,
      markMessageReplied: async () => {},
      logRepliedEvent: async () => {},
    };

    const raw =
      "Thank you! We had tons of fun. Received the invoice and made our first payment - yay!\n" +
      "    On Monday, November 2, 2026 at 11:36:03 PM EST, Hello to Cheers <jennifer@hellotocheers.com> wrote:  \n" +
      " \n   \n|   \nMeadowbrook Valley Venue\n";

    await recordInboundConversationEmail(
      recorder,
      {
        conversationId: CONVERSATION_ID,
        venueId: "venue-1",
        relationshipId: "rel-1",
        entityType: "client",
        entityId: "client-1",
      },
      raw,
    );

    assert.equal(
      inserted[0]?.body,
      "Thank you! We had tons of fun. Received the invoice and made our first payment - yay!",
    );
  });
});

describe("stripEmailReplyQuotes", () => {
  it("keeps only the new reply above an On … wrote: header", () => {
    assert.equal(
      stripEmailReplyQuotes(
        "Looks great!\n\nOn Mon, Nov 2, 2026 at 3:00 PM Jen <jen@example.com> wrote:\n> prior note",
      ),
      "Looks great!",
    );
  });

  it("strips Outlook Original Message separators", () => {
    assert.equal(
      stripEmailReplyQuotes("Confirmed.\n\n-----Original Message-----\nFrom: Jen"),
      "Confirmed.",
    );
  });

  it("leaves plain replies without quotes unchanged", () => {
    assert.equal(stripEmailReplyQuotes("  We can do Saturday.  "), "We can do Saturday.");
  });
});
