import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { filterLegalHistoryItemsForScope } from "@/lib/legal/service";
import type { LegalAcceptanceHistoryItem } from "@/lib/legal/types";

function row(
  partial: Partial<LegalAcceptanceHistoryItem> &
    Pick<LegalAcceptanceHistoryItem, "id" | "documentType" | "documentTitle">,
): LegalAcceptanceHistoryItem {
  return {
    acceptedVersion: "1.0",
    acceptedAt: "2026-01-01T00:00:00.000Z",
    acceptanceMethod: "Venue Signup",
    ...partial,
  };
}

describe("filterLegalHistoryItemsForScope", () => {
  const mixed: LegalAcceptanceHistoryItem[] = [
    row({
      id: "1",
      documentType: "vendor_end_user_terms",
      documentTitle: "Vendor Terms",
      acceptanceMethod: "Vendor Invitation",
    }),
    row({
      id: "2",
      documentType: "privacy_policy",
      documentTitle: "Privacy Policy",
      acceptanceMethod: "Venue Signup",
    }),
    row({
      id: "3",
      documentType: "couple_end_user_terms",
      documentTitle: "End User Terms",
      acceptanceMethod: "Couple Invitation",
    }),
    row({
      id: "4",
      documentType: "acceptable_use_policy",
      documentTitle: "Acceptable Use Policy",
    }),
    row({
      id: "5",
      documentType: "cookie_policy",
      documentTitle: "Cookie Policy",
    }),
    row({
      id: "6",
      documentType: "terms_of_service",
      documentTitle: "Venue Subscription Agreement",
    }),
  ];

  it("vendor scope keeps only Vendor Terms + Privacy Policy", () => {
    const filtered = filterLegalHistoryItemsForScope(mixed, "vendor");
    assert.deepEqual(
      filtered.map((r) => r.documentType),
      ["vendor_end_user_terms", "privacy_policy"],
    );
    assert.equal(
      filtered.find((r) => r.documentType === "privacy_policy")?.acceptanceMethod,
      "Venue Signup",
    );
  });

  it("venue scope leaves the full multi-role history unchanged", () => {
    const filtered = filterLegalHistoryItemsForScope(mixed, "venue");
    assert.equal(filtered.length, mixed.length);
    assert.equal(filtered, mixed);
  });

  it("client scope leaves history unchanged (vendor-only filter)", () => {
    const filtered = filterLegalHistoryItemsForScope(mixed, "client");
    assert.equal(filtered.length, mixed.length);
  });
});
