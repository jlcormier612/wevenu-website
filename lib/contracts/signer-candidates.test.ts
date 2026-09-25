/**
 * Required client signer candidates — unit tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildSignerCandidates,
  defaultSelectedSignerIds,
  RELATIONSHIP_PARTNER_SIGNER_ID,
  RELATIONSHIP_PRIMARY_SIGNER_ID,
  resolveSignerSeedsFromSelection,
} from "@/lib/contracts/signer-candidates";
import { DEFERRED_MERGE_FIELD_KEYS, MERGE_FIELDS } from "@/lib/contracts/constants";
import type { Client } from "@/lib/clients/types";
import type { ClientContact } from "@/lib/contacts/types";

function client(partial: Partial<Client> & Pick<Client, "id" | "firstName" | "lastName">): Client {
  return {
    venueId: "v",
    leadId: null,
    status: "booking",
    email: null,
    phone: null,
    partnerFirstName: null,
    partnerLastName: null,
    partnerEmail: null,
    eventType: null,
    eventDate: null,
    endDate: null,
    guestCount: null,
    ceremonyTime: null,
    receptionTime: null,
    rehearsalDate: null,
    internalNotes: null,
    relationshipId: null,
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

describe("signer candidates from client relationship", () => {
  it("does not treat a two-name relationship as a single signer", () => {
    const c = client({
      id: "c1",
      firstName: "Lydia",
      lastName: "Cormier",
      email: "lydia@example.com",
      partnerFirstName: "Ali",
      partnerLastName: "Shazam",
      partnerEmail: "ali@example.com",
    });
    const candidates = buildSignerCandidates(c, []);
    assert.equal(candidates.length, 2);
    assert.equal(candidates[0].id, RELATIONSHIP_PRIMARY_SIGNER_ID);
    assert.equal(candidates[0].name, "Lydia Cormier");
    assert.equal(candidates[0].email, "lydia@example.com");
    assert.equal(candidates[1].id, RELATIONSHIP_PARTNER_SIGNER_ID);
    assert.equal(candidates[1].name, "Ali Shazam");
    assert.equal(candidates[1].email, "ali@example.com");
    assert.deepEqual(defaultSelectedSignerIds(candidates), [RELATIONSHIP_PRIMARY_SIGNER_ID]);
  });

  it("shows partner without email as non-selectable", () => {
    const c = client({
      id: "c1",
      firstName: "Belle",
      lastName: "Frenchie",
      email: "belle@example.com",
      partnerFirstName: "Gaston",
      partnerLastName: "Gustard",
      partnerEmail: null,
    });
    const candidates = buildSignerCandidates(c, []);
    const partner = candidates.find((x) => x.id === RELATIONSHIP_PARTNER_SIGNER_ID);
    assert.ok(partner);
    assert.equal(partner!.selectable, false);
  });

  it("resolves two required seeds with separate emails", () => {
    const c = client({
      id: "c1",
      firstName: "Lydia",
      lastName: "Cormier",
      email: "lydia@example.com",
      partnerFirstName: "Ali",
      partnerLastName: "Shazam",
      partnerEmail: "ali@example.com",
    });
    const result = resolveSignerSeedsFromSelection(c, [], [
      RELATIONSHIP_PRIMARY_SIGNER_ID,
      RELATIONSHIP_PARTNER_SIGNER_ID,
    ]);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.seeds.length, 2);
    assert.equal(result.seeds[0].signerEmail, "lydia@example.com");
    assert.equal(result.seeds[1].signerEmail, "ali@example.com");
  });

  it("uses contact rows when present", () => {
    const c = client({
      id: "c1",
      firstName: "A",
      lastName: "B",
      email: "a@example.com",
    });
    const contacts = [{
      id: "ct1",
      venueId: "v",
      clientId: "c1",
      firstName: "A",
      lastName: "B",
      email: "a@example.com",
      phone: null,
      relationship: null,
      roleLabel: null,
      portalRole: null,
      receivesReminders: true,
      isPrimary: true,
      notes: null,
      sortOrder: 0,
      status: "active" as const,
      lastActivityAt: null,
      isPayer: false,
      isDecisionMaker: false,
      isEmergencyContact: false,
      invitedAt: null,
      createdAt: "",
      updatedAt: "",
    }] satisfies ClientContact[];
    const candidates = buildSignerCandidates(c, contacts);
    assert.ok(candidates.some((x) => x.id === "ct1"));
    assert.ok(!candidates.some((x) => x.id === RELATIONSHIP_PRIMARY_SIGNER_ID));
  });
});

describe("contract-time Smart Fields", () => {
  it("excludes deferred operational/payment fields from the standard picker", () => {
    const keys = MERGE_FIELDS.map((f) => f.key);
    for (const deferred of DEFERRED_MERGE_FIELD_KEYS) {
      assert.ok(!keys.includes(deferred), deferred);
    }
    assert.ok(keys.includes("package_section"));
    assert.ok(keys.includes("contract_total"));
    assert.ok(keys.includes("client_name"));
  });
});
