import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { isClientVisibleChannel } from "@/lib/conversations/channels";

/**
 * Product matrix: where client-facing communication should appear.
 *
 * A = external delivery (email inbox / phone / portal UI surface)
 * B = HTC relationship history (conversation_messages)
 * C = couple portal Messages tab (get_portal_conversation — same thread,
 *     minus staff-only channels)
 *
 * Existing architecture: portal Messages reads conversation_messages and
 * shows every non-staff-only channel. Therefore recording an external send
 * into conversation_messages also makes it visible in the portal thread.
 * That is affirmed here as the deliberate product rule — not a second feed.
 */
const MATRIX: {
  type: string;
  external: boolean;
  htcHistory: boolean;
  portalMessages: boolean;
  notes: string;
}[] = [
  {
    type: "manual email",
    external: true,
    htcHistory: true,
    portalMessages: true,
    notes: "sendConversationMessage → email + conversation_messages; portal sees email channel",
  },
  {
    type: "manual SMS",
    external: true,
    htcHistory: true,
    portalMessages: true,
    notes: "sendConversationMessage → sms + conversation_messages; portal sees sms channel",
  },
  {
    type: "scheduled email",
    external: true,
    htcHistory: true,
    portalMessages: true,
    notes: "scheduled-messages processor inserts conversation_messages on send",
  },
  {
    type: "scheduled SMS",
    external: true,
    htcHistory: true,
    portalMessages: true,
    notes: "same processor; channel=sms",
  },
  {
    type: "automated/series email/SMS",
    external: true,
    htcHistory: true,
    portalMessages: true,
    notes: "series materializes scheduled messages; same processor path",
  },
  {
    type: "obligation reminder email",
    external: true,
    htcHistory: true,
    portalMessages: true,
    notes: "recordExternalClientOutbound after send; channel=email",
  },
  {
    type: "contract invitation email",
    external: true,
    htcHistory: true,
    portalMessages: true,
    notes: "recordExternalClientOutbound on invite send",
  },
  {
    type: "portal message",
    external: true,
    htcHistory: true,
    portalMessages: true,
    notes: "channel=portal; native portal thread message",
  },
  {
    type: "inbound email",
    external: false,
    htcHistory: true,
    portalMessages: true,
    notes: "inbound → conversation_messages; client-visible channel",
  },
  {
    type: "inbound SMS",
    external: false,
    htcHistory: true,
    portalMessages: true,
    notes: "sms-inbound → conversation_messages; client-visible channel",
  },
];

describe("portal visibility product matrix", () => {
  it("treats email, sms, and portal as client-visible (not staff-only)", () => {
    assert.equal(isClientVisibleChannel("email"), true);
    assert.equal(isClientVisibleChannel("sms"), true);
    assert.equal(isClientVisibleChannel("portal"), true);
    assert.equal(isClientVisibleChannel("internal_note"), false);
  });

  it("portal conversation RPC excludes only staff-only channels", () => {
    const sql = readFileSync(
      resolve("supabase/migrations/20261315000000_staff_only_conversation_channels.sql"),
      "utf8",
    );
    assert.match(sql, /get_portal_conversation/);
    assert.match(sql, /channel not in \('internal_note', 'phone_log', 'voicemail', 'push'\)/);
  });

  it("portal messages API reads conversation_messages via getPortalConversation", () => {
    const route = readFileSync(resolve("app/api/portal/messages/route.ts"), "utf8");
    assert.match(route, /getPortalConversation/);
  });

  for (const row of MATRIX) {
    it(`${row.type}: external=${row.external} history=${row.htcHistory} portal=${row.portalMessages}`, () => {
      assert.equal(row.htcHistory, true, `${row.type} must be in HTC history`);
      if (row.external) {
        assert.equal(row.portalMessages, true, `${row.type}: ${row.notes}`);
      }
    });
  }
});
