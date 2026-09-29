import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Contract } from "@/lib/contracts/types";
import {
  contractMatchesListFilter,
  contractSigningFilterKey,
  countVenueActionRequiredContracts,
  isVenueActionRequiredContract,
  parseContractListFilter,
  rollupContractsToCurrentAgreements,
} from "@/lib/contracts/list-filters";

function contract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: "c1",
    venueId: "v1",
    clientId: "cl1",
    eventId: null,
    templateId: null,
    title: "Venue Rental Agreement",
    status: "draft",
    content: "",
    notes: null,
    sentAt: null,
    signedAt: null,
    expiresAt: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    amendsContractId: null,
    clientName: "Jane Smith",
    eventDate: null,
    venueSigned: false,
    requiredClientTotal: 1,
    requiredClientSigned: 0,
    ...overrides,
  } as Contract;
}

describe("contract list filters — venue action required", () => {
  it("defaults to Action Required", () => {
    assert.equal(parseContractListFilter(undefined), "action_required");
    assert.equal(parseContractListFilter("nope"), "action_required");
    assert.equal(parseContractListFilter("sent_to_client"), "sent_to_client");
  });

  it("counts only Draft and Awaiting Venue Signature", () => {
    const rows = [
      contract({ id: "d", status: "draft" }),
      contract({
        id: "avs",
        status: "sent",
        venueSigned: false,
        requiredClientTotal: 1,
        requiredClientSigned: 1,
      }),
      contract({
        id: "stc",
        status: "sent",
        venueSigned: false,
        requiredClientTotal: 1,
        requiredClientSigned: 0,
      }),
      contract({ id: "fe", status: "signed", venueSigned: true, requiredClientSigned: 1 }),
    ];
    assert.equal(isVenueActionRequiredContract(rows[0]), true);
    assert.equal(isVenueActionRequiredContract(rows[1]), true);
    assert.equal(isVenueActionRequiredContract(rows[2]), false);
    assert.equal(isVenueActionRequiredContract(rows[3]), false);
    assert.equal(countVenueActionRequiredContracts(rows), 2);
    assert.equal(contractSigningFilterKey(rows[2]), "sent_to_client");
    assert.ok(contractMatchesListFilter(rows[0], "action_required"));
    assert.ok(!contractMatchesListFilter(rows[2], "action_required"));
    assert.ok(contractMatchesListFilter(rows[2], "sent_to_client"));
    assert.ok(contractMatchesListFilter(rows[2], "all"));
  });

  it("keeps Expired distinct from Cancelled", () => {
    const expired = contract({ id: "e", status: "expired" });
    assert.equal(contractSigningFilterKey(expired), "expired");
    assert.ok(contractMatchesListFilter(expired, "expired"));
    assert.ok(!contractMatchesListFilter(expired, "cancelled"));
    assert.ok(!isVenueActionRequiredContract(expired));
  });
});

describe("contracts page operational job", () => {
  it("states the Action Required job and keeps search", () => {
    const page = readFileSync(resolve("app/(app)/contracts/page.tsx"), "utf8");
    assert.match(page, /Which contracts need something from me\?/);
    assert.match(page, /getContractsForWorkflowList/);
    const list = readFileSync(resolve("components/contracts/contract-list.tsx"), "utf8");
    assert.match(list, /Search contracts/);
    assert.match(list, /parseContractListFilter/);
    assert.match(list, /listFamilySize/);
    const attention = readFileSync(resolve("lib/navigation/attention-service.ts"), "utf8");
    assert.match(attention, /rollupContractsToCurrentAgreements\(contracts\)/);
  });
});

describe("contract list rollup — explicit amends_contract_id only", () => {
  it("keeps a standalone contract as one row", () => {
    const rows = rollupContractsToCurrentAgreements([
      contract({ id: "alone", title: "Standalone", status: "draft" }),
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, "alone");
    assert.equal(rows[0].listFamilySize, 1);
    assert.equal(rows[0].listVersionNumber, 1);
  });

  it("shows only the current tip of an amends chain", () => {
    const v1 = contract({
      id: "a",
      title: "Venue Rental Agreement",
      status: "signed",
      createdAt: "2026-09-01T00:00:00.000Z",
      venueSigned: true,
      requiredClientSigned: 1,
    });
    const v2 = contract({
      id: "b",
      title: "Venue Rental Agreement",
      status: "draft",
      amendsContractId: "a",
      createdAt: "2026-09-10T00:00:00.000Z",
    });
    const rows = rollupContractsToCurrentAgreements([v1, v2]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, "b");
    assert.equal(rows[0].listVersionNumber, 2);
    assert.equal(rows[0].listFamilySize, 2);
    assert.ok(contractMatchesListFilter(rows[0], "action_required"));
    assert.ok(!contractMatchesListFilter(rows[0], "fully_signed"));
    assert.equal(countVenueActionRequiredContracts(rows), 1);
  });

  it("does not infer a family from the same client, title, or event", () => {
    const rebecca = [
      "8df17edd-f960-44d4-9bc5-c2c1c348df46",
      "5a5f8117-4616-4935-82c7-ce58b75f721b",
      "0ef3f64d-540e-41e5-a936-602d2d87610f",
      "9884ea27-b99d-44bb-aeb7-599f99bd5d4a",
    ].map((id, i) =>
      contract({
        id,
        title: "Venue Rental Agreement",
        clientId: "rebecca",
        clientName: "Rebecca Sunshine",
        eventId: "same-event",
        status: "signed",
        createdAt: `2026-09-0${i + 1}T00:00:00.000Z`,
        amendsContractId: null,
        venueSigned: true,
        requiredClientSigned: 1,
      }),
    );
    const rows = rollupContractsToCurrentAgreements(rebecca);
    assert.equal(rows.length, 4);
    assert.deepEqual(new Set(rows.map((r) => r.id)), new Set(rebecca.map((r) => r.id)));
    assert.ok(rows.every((r) => r.listFamilySize === 1));
  });

  it("does not double-count a family in the venue-action badge", () => {
    const historicalDraft = contract({
      id: "old",
      status: "draft",
      createdAt: "2026-08-01T00:00:00.000Z",
    });
    const currentDraft = contract({
      id: "new",
      status: "draft",
      amendsContractId: "old",
      createdAt: "2026-09-01T00:00:00.000Z",
    });
    assert.equal(countVenueActionRequiredContracts([historicalDraft, currentDraft]), 2);
    assert.equal(
      countVenueActionRequiredContracts(
        rollupContractsToCurrentAgreements([historicalDraft, currentDraft]),
      ),
      1,
    );
  });
});
