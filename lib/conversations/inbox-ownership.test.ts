import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  inboxCategoryFromConversation,
  inboxCategoryFromOwnership,
} from "@/lib/conversations/inbox-ownership";

describe("inbox-ownership", () => {
  it("A–C: lead-owned stays Leads across open / booked / lost", () => {
    assert.equal(
      inboxCategoryFromConversation({
        inboxOwnerKind: "lead",
        leadId: "l",
        clientId: "c",
      }),
      "leads",
    );
  });

  it("D–F: client-owned stays Clients even with a sibling lead", () => {
    assert.equal(
      inboxCategoryFromOwnership({ inboxOwnerKind: "client", hasLead: true, hasClient: true }),
      "clients",
    );
  });

  it("legacy fallback: hasLead → Leads without consulting stage", () => {
    assert.equal(
      inboxCategoryFromOwnership({ hasLead: true, hasClient: true }),
      "leads",
    );
    assert.equal(
      inboxCategoryFromOwnership({ hasLead: false, hasClient: true }),
      "clients",
    );
  });
});
