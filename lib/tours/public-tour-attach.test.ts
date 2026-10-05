import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createTourOriginToken } from "@/lib/tours/origin-context";
import { decidePublicTourAttach, type PublicTourLeadRow } from "@/lib/tours/public-tour-attach";

const SECRET = "test-tour-origin-secret";
const VENUE = "venue-a";
const OTHER_VENUE = "venue-b";

function openLead(partial: Partial<PublicTourLeadRow> & { id: string }): PublicTourLeadRow {
  return {
    venueId: VENUE,
    salesStage: "new_inquiry",
    email: "couple@example.com",
    partnerEmail: null,
    relationshipId: "rel-1",
    ...partial,
  };
}

describe("public tour attach decision", () => {
  it("attaches a valid originating context to the original open Lead", () => {
    const token = createTourOriginToken(
      { venueId: VENUE, leadId: "lead-orig", nowMs: 1_000, ttlMs: 60_000 },
      SECRET,
    );
    const lead = openLead({ id: "lead-orig" });
    assert.deepEqual(
      decidePublicTourAttach({
        venueId: VENUE,
        originToken: token,
        signingSecret: SECRET,
        originLead: lead,
        email: "other@example.com",
        openEmailMatches: [openLead({ id: "lead-other", email: "other@example.com" })],
        nowMs: 1_500,
      }),
      { action: "attach", leadId: "lead-orig", relationshipId: "rel-1", source: "origin" },
    );
  });

  it("rejects tampered tokens and cross-venue originating context", () => {
    const token = createTourOriginToken(
      { venueId: VENUE, leadId: "lead-orig", nowMs: 1_000, ttlMs: 60_000 },
      SECRET,
    );
    const tampered = token.replace("lead-orig", "lead-other");
    assert.equal(
      decidePublicTourAttach({
        venueId: VENUE,
        originToken: tampered,
        signingSecret: SECRET,
        originLead: openLead({ id: "lead-other" }),
        email: "couple@example.com",
        openEmailMatches: [],
        nowMs: 1_500,
      }).action,
      "reject",
    );
    assert.equal(
      decidePublicTourAttach({
        venueId: OTHER_VENUE,
        originToken: token,
        signingSecret: SECRET,
        originLead: openLead({ id: "lead-orig", venueId: VENUE }),
        email: "couple@example.com",
        openEmailMatches: [],
        nowMs: 1_500,
      }).action,
      "reject",
    );
  });

  it("does not silently attach originating context to a booked/lost/terminal Lead", () => {
    const token = createTourOriginToken(
      { venueId: VENUE, leadId: "lead-booked", nowMs: 1_000, ttlMs: 60_000 },
      SECRET,
    );
    assert.equal(
      decidePublicTourAttach({
        venueId: VENUE,
        originToken: token,
        signingSecret: SECRET,
        originLead: openLead({ id: "lead-booked", salesStage: "booked" }),
        email: "couple@example.com",
        openEmailMatches: [],
        nowMs: 1_500,
      }).action,
      "reject",
    );
  });

  it("with no originating context attaches when exactly one open normalized-email Lead exists", () => {
    assert.deepEqual(
      decidePublicTourAttach({
        venueId: VENUE,
        originToken: null,
        signingSecret: SECRET,
        originLead: null,
        email: "Couple@example.com",
        openEmailMatches: [openLead({ id: "lead-one", email: "couple@example.com" })],
      }),
      { action: "attach", leadId: "lead-one", relationshipId: "rel-1", source: "email" },
    );
  });

  it("with no originating context creates when zero open email matches", () => {
    assert.deepEqual(
      decidePublicTourAttach({
        venueId: VENUE,
        originToken: null,
        signingSecret: SECRET,
        originLead: null,
        email: "new@example.com",
        openEmailMatches: [],
      }),
      { action: "create" },
    );
  });

  it("with no originating context does not guess when multiple open same-email Leads exist", () => {
    assert.deepEqual(
      decidePublicTourAttach({
        venueId: VENUE,
        originToken: null,
        signingSecret: SECRET,
        originLead: null,
        email: "couple@example.com",
        openEmailMatches: [
          openLead({ id: "lead-a" }),
          openLead({ id: "lead-b", relationshipId: "rel-2" }),
        ],
      }),
      { action: "create" },
    );
  });

  it("does not reuse a booked/lost/terminal Lead via email fallback", () => {
    assert.deepEqual(
      decidePublicTourAttach({
        venueId: VENUE,
        originToken: null,
        signingSecret: SECRET,
        originLead: null,
        email: "couple@example.com",
        openEmailMatches: [openLead({ id: "lead-booked", salesStage: "booked" })],
      }),
      { action: "create" },
    );
  });

  it("does not attach by name only", () => {
    assert.deepEqual(
      decidePublicTourAttach({
        venueId: VENUE,
        originToken: null,
        signingSecret: SECRET,
        originLead: null,
        email: "",
        openEmailMatches: [openLead({ id: "lead-named", email: "someone@example.com" })],
      }),
      { action: "create" },
    );
  });
});
