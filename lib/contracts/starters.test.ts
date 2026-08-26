/**
 * Wedding Venue Agreement starter — unit tests (node:test).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildMergeData, mergeContent } from "@/lib/contracts/merge";
import {
  assertCustomerSafeContractContent,
  findUntouchedPolicyPlaceholders,
  WEDDING_VENUE_AGREEMENT_CONTENT,
  WEDDING_VENUE_AGREEMENT_NAME,
} from "@/lib/contracts/starters";

describe("Wedding Venue Agreement starter", () => {
  it("uses the customer-facing name and has no invented arbitration/indemnity clauses", () => {
    assert.equal(WEDDING_VENUE_AGREEMENT_NAME, "Wedding Venue Agreement");
    assert.match(
      WEDDING_VENUE_AGREEMENT_CONTENT,
      /Add your venue's approved cancellation and rescheduling policy here\./,
    );
    assert.doesNotMatch(WEDDING_VENUE_AGREEMENT_CONTENT, /binding arbitration/i);
    assert.doesNotMatch(WEDDING_VENUE_AGREEMENT_CONTENT, /indemnif/i);
  });

  it("detects untouched policy placeholders", () => {
    const hits = findUntouchedPolicyPlaceholders(WEDDING_VENUE_AGREEMENT_CONTENT);
    assert.ok(hits.length > 5);
  });

  it("blocks send-facing content that still has placeholders", () => {
    const result = assertCustomerSafeContractContent(WEDDING_VENUE_AGREEMENT_CONTENT);
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.placeholders.length > 0);
  });

  it("allows content after placeholders are replaced and tokens merged", () => {
    const filledPolicies = WEDDING_VENUE_AGREEMENT_CONTENT.replace(
      /Add your venue's approved[^\n.]*\./g,
      "Venue-approved policy language goes here after legal review.",
    );
    const data = buildMergeData({
      venueName: "Garden Hall",
      venueAddress: "1 Oak St",
      venuePhone: "555",
      venueEmail: "h@example.com",
      clientFirstName: "Ada",
      clientLastName: "Lovelace",
      partnerFirstName: "Charles",
      partnerLastName: "Babbage",
      clientEmail: "a@example.com",
      clientPhone: "555",
      eventName: "Ada & Charles",
      eventDate: "2027-06-12",
      eventType: "wedding",
      guestCount: 120,
      eventSpaces: "Ballroom",
      coordinatorName: "Jordan",
      venueAccessHours: "Start 2:00 PM · End 11:00 PM",
      ceremonySummary: "Garden · 3:00 PM",
      receptionSummary: "Ballroom · 5:00 PM",
      packageSection: "Classic Wedding Package",
      includedItemsSummary: "• Tables",
      additionalItemsSummary: "• Extra hour",
      paymentScheduleSummary: "• Deposit $1,000",
      contractTotal: "$10,000",
      balanceRemaining: "$9,000",
      vendorsOnFile: "• Florist",
      contractTitle: "Wedding Venue Agreement",
    });
    const merged = mergeContent(filledPolicies, data);
    const result = assertCustomerSafeContractContent(merged);
    assert.equal(result.ok, true);
    assert.match(merged, /Garden Hall/);
    assert.equal(merged.includes("{{"), false);
  });

  it("exposes first/last/full name merge tokens from client columns", () => {
    const data = buildMergeData({
      venueName: "Garden Hall",
      clientFirstName: "Ada",
      clientLastName: "Lovelace",
      partnerFirstName: null,
      partnerLastName: null,
      eventDate: "2027-06-12",
      eventType: "wedding",
      guestCount: 80,
      contractTitle: "Agreement",
    });
    assert.equal(data.first_name, "Ada");
    assert.equal(data.last_name, "Lovelace");
    assert.equal(data.full_name, "Ada Lovelace");
    assert.equal(mergeContent("Dear {{first_name}},", data), "Dear Ada,");
  });
});
