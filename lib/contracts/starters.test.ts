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

  it("warns on send-facing content that still has placeholders", () => {
    const result = assertCustomerSafeContractContent(WEDDING_VENUE_AGREEMENT_CONTENT);
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.placeholders.length > 0);
  });

  it("returns STARTER_POLICY_PLACEHOLDERS when only placeholders remain", () => {
    const result = assertCustomerSafeContractContent(
      "Add your venue's approved cancellation and rescheduling policy here.",
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "STARTER_POLICY_PLACEHOLDERS");
      assert.match(result.message, /starter policy placeholders/);
      assert.equal(result.unresolvedTokens.length, 0);
    }
  });

  it("allows placeholders when the venue acknowledges the warning", () => {
    const result = assertCustomerSafeContractContent(
      "Add your venue's approved cancellation and rescheduling policy here.",
      { allowPlaceholders: true },
    );
    assert.equal(result.ok, true);
  });

  it("still hard-blocks unresolved tokens even when placeholders are acknowledged", () => {
    const result = assertCustomerSafeContractContent(
      "Add your venue's approved cancellation and rescheduling policy here.\n{{unknown_token}}",
      { allowPlaceholders: true },
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, undefined);
      assert.match(result.message, /Unresolved details/);
    }
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
      clientEmail: "a@example.com",
      clientPhone: "555",
      eventName: "Ada & Charles",
      eventDate: "2027-06-12",
      eventType: "wedding",
      guestCount: 120,
      contractTitle: "Wedding Venue Agreement",
    });
    const merged = mergeContent(filledPolicies, data);
    const result = assertCustomerSafeContractContent(merged);
    assert.equal(result.ok, true);
    assert.match(merged, /Garden Hall/);
    assert.match(merged, /Ada Lovelace/);
    assert.doesNotMatch(merged, /Charles Babbage/);
    assert.equal(merged.includes("{{"), false);
    assert.equal(data.client_name, "Ada Lovelace");
    assert.equal(data.couple_name, undefined);
    assert.equal(data.primary_contact_name, undefined);
    assert.equal(data.full_name, undefined);
    assert.equal(data.partner_name, undefined);
    assert.doesNotMatch(WEDDING_VENUE_AGREEMENT_CONTENT, /\{\{venue_access_hours\}\}/);
    assert.doesNotMatch(WEDDING_VENUE_AGREEMENT_CONTENT, /\{\{ceremony_summary\}\}/);
    assert.doesNotMatch(WEDDING_VENUE_AGREEMENT_CONTENT, /\{\{reception_summary\}\}/);
    assert.doesNotMatch(WEDDING_VENUE_AGREEMENT_CONTENT, /\{\{coordinator_name\}\}/);
    assert.match(WEDDING_VENUE_AGREEMENT_CONTENT, /\{\{event_spaces\}\}/);
    assert.match(WEDDING_VENUE_AGREEMENT_CONTENT, /\{\{ceremony_space\}\}/);
    assert.match(WEDDING_VENUE_AGREEMENT_CONTENT, /\{\{reception_space\}\}/);
    assert.match(WEDDING_VENUE_AGREEMENT_CONTENT, /\{\{package_section\}\}/);
    assert.match(WEDDING_VENUE_AGREEMENT_CONTENT, /\{\{contract_total\}\}/);
    assert.match(WEDDING_VENUE_AGREEMENT_CONTENT, /\{\{payment_schedule_summary\}\}/);
    assert.match(WEDDING_VENUE_AGREEMENT_CONTENT, /\{\{balance_remaining\}\}/);
    assert.match(WEDDING_VENUE_AGREEMENT_CONTENT, /\{\{included_items_summary\}\}/);
    assert.doesNotMatch(WEDDING_VENUE_AGREEMENT_CONTENT, /\{\{vendors_on_file\}\}/);
    assert.doesNotMatch(
      WEDDING_VENUE_AGREEMENT_CONTENT,
      /Add your venue's approved ceremony timing and location language/,
    );
    assert.doesNotMatch(
      WEDDING_VENUE_AGREEMENT_CONTENT,
      /Add your venue's approved reception timing and location language/,
    );
  });

  it("exposes first/last/client name from the primary client contact", () => {
    const data = buildMergeData({
      venueName: "Garden Hall",
      clientFirstName: "Ada",
      clientLastName: "Lovelace",
      eventDate: "2027-06-12",
      eventType: "wedding",
      guestCount: 80,
      contractTitle: "Agreement",
    });
    assert.equal(data.first_name, "Ada");
    assert.equal(data.last_name, "Lovelace");
    assert.equal(data.client_name, "Ada Lovelace");
    assert.equal(mergeContent("Dear {{first_name}},", data), "Dear Ada,");
  });
});
