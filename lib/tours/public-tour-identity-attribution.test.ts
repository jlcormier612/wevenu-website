/**
 * Public tour identity attribution: conflicting form identity must not
 * silently attach to another open lead that only shares an email.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { createTourOriginToken } from "@/lib/tours/origin-context";
import {
  decidePublicTourAttach,
  publicTourIdentityConflicts,
  type PublicTourLeadRow,
} from "@/lib/tours/public-tour-attach";

const SECRET = "test-tour-origin-secret";
const VENUE = "venue-a";

function openLead(partial: Partial<PublicTourLeadRow> & { id: string }): PublicTourLeadRow {
  return {
    venueId: VENUE,
    salesStage: "new_inquiry",
    email: "shared@example.com",
    partnerEmail: null,
    relationshipId: "rel-1",
    firstName: "Betty",
    lastName: "Boop",
    phone: "5551112222",
    ...partial,
  };
}

describe("publicTourIdentityConflicts", () => {
  it("detects conflicting names or phones", () => {
    assert.equal(
      publicTourIdentityConflicts(
        { firstName: "Betty", lastName: "Boop", phone: "5551112222" },
        { firstName: "Lorelai", lastName: "Gilmore", phone: "5559998888" },
      ),
      true,
    );
  });

  it("allows matching identity and incomplete halves", () => {
    assert.equal(
      publicTourIdentityConflicts(
        { firstName: "Betty", lastName: "Boop", phone: "5551112222" },
        { firstName: "Betty", lastName: "Boop", phone: "(555) 111-2222" },
      ),
      false,
    );
    assert.equal(
      publicTourIdentityConflicts(
        { firstName: "Betty", lastName: "Boop", phone: "5551112222" },
        { firstName: "Betty", lastName: "", phone: "" },
      ),
      false,
    );
  });
});

describe("public tour attribution decisions", () => {
  it("two tours sharing an email with conflicting names create rather than attach", () => {
    const betty = openLead({ id: "lead-betty" });
    assert.deepEqual(
      decidePublicTourAttach({
        venueId: VENUE,
        originToken: null,
        signingSecret: SECRET,
        originLead: null,
        email: "shared@example.com",
        openEmailMatches: [betty],
        submittedIdentity: { firstName: "Other", lastName: "Person", phone: "5553334444" },
      }),
      { action: "create" },
    );
  });

  it("valid origin token still attaches to the intended lead", () => {
    const token = createTourOriginToken(
      { venueId: VENUE, leadId: "lead-orig", nowMs: 1_000, ttlMs: 60_000 },
      SECRET,
    );
    assert.deepEqual(
      decidePublicTourAttach({
        venueId: VENUE,
        originToken: token,
        signingSecret: SECRET,
        originLead: openLead({ id: "lead-orig" }),
        email: "other@example.com",
        openEmailMatches: [],
        submittedIdentity: { firstName: "Other", lastName: "Person", phone: "5550001111" },
        nowMs: 1_500,
      }),
      { action: "attach", leadId: "lead-orig", relationshipId: "rel-1", source: "origin" },
    );
  });

  it("invalid or wrong-venue origin token never grants unauthorized attachment", () => {
    const token = createTourOriginToken(
      { venueId: VENUE, leadId: "lead-orig", nowMs: 1_000, ttlMs: 60_000 },
      SECRET,
    );
    assert.equal(
      decidePublicTourAttach({
        venueId: "venue-b",
        originToken: token,
        signingSecret: SECRET,
        originLead: openLead({ id: "lead-orig" }),
        email: "shared@example.com",
        openEmailMatches: [],
        nowMs: 1_500,
      }).action,
      "reject",
    );
    assert.equal(
      decidePublicTourAttach({
        venueId: VENUE,
        originToken: null,
        signingSecret: SECRET,
        originLead: null,
        email: "shared@example.com",
        openEmailMatches: [],
      }).action,
      "create",
    );
  });

  it("multiple open email matches create rather than guess", () => {
    assert.deepEqual(
      decidePublicTourAttach({
        venueId: VENUE,
        originToken: null,
        signingSecret: SECRET,
        originLead: null,
        email: "shared@example.com",
        openEmailMatches: [openLead({ id: "a" }), openLead({ id: "b", relationshipId: "rel-2" })],
        submittedIdentity: { firstName: "Betty", lastName: "Boop", phone: "5551112222" },
      }),
      { action: "create" },
    );
  });
});

describe("submitted identity persistence seams", () => {
  it("bookTour passes submitted identity into attach decision and RPC", () => {
    const service = readFileSync(resolve("lib/tours/service.ts"), "utf8");
    assert.match(service, /submittedIdentity:\s*\{/);
    assert.match(service, /p_contact_name/);
    assert.match(service, /p_contact_email/);
    assert.match(service, /p_contact_phone/);
  });

  it("migration preserves submitted contact fields and never updates leads", () => {
    const sql = readFileSync(
      resolve("supabase/migrations/20261418600000_book_public_tour_preserves_submitted_identity.sql"),
      "utf8",
    );
    assert.match(sql, /p_contact_name/);
    assert.match(sql, /coalesce\(nullif\(trim\(p_contact_name\)/);
    assert.doesNotMatch(sql, /update\s+public\.leads/i);
  });
});
