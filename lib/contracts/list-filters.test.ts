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
    const list = readFileSync(resolve("components/contracts/contract-list.tsx"), "utf8");
    assert.match(list, /Search contracts/);
    assert.match(list, /parseContractListFilter/);
  });
});
