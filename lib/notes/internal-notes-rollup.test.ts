/**
 * Internal Notes workspace — projection of venue-private sources.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { buildFollowUpPrompt } from "@/lib/luv/drafts";
import { venueFacingCompletedTourThoughts } from "@/lib/luv/venue-facing-tour-thoughts";
import {
  buildInternalNotesRollup,
  compareInternalNoteRollup,
  tourNotesEchoCustomerInquiry,
} from "@/lib/notes/internal-notes-rollup";
import type { Lead } from "@/lib/leads/types";

const INQUIRY =
  "Small affair - family and business personnel only. Ceremony on the casino boat — Reception in the barn. Needs to be private and provide security.";
const TOUR =
  "Wendy walked in and we accommodated them. They loved the venue and especially how private and secluded the farm is. They will provide their own security for the event.";
const DIRECT = "Called Marty about catering minimums.";

const OTHER_CLIENT_NOTE = "OTHER-CLIENT-SECRET-NOTE";

function lead(): Lead {
  return {
    id: "L1",
    venueId: "v1",
    salesStage: "tour_scheduled",
    status: "tour_scheduled",
    firstName: "Wendy",
    lastName: "Davis",
    partnerFirstName: null,
    partnerLastName: null,
    email: "wendy@example.com",
    phone: null,
    eventType: "wedding",
    eventDate: "2027-06-14",
    guestCount: 80,
    estimatedBudget: 20000,
    inquiryMessage: INQUIRY,
    inquiryMessageOrigin: "venue",
    inquiryDate: "2026-10-03",
    lastContactedAt: null,
  } as Lead;
}

describe("buildInternalNotesRollup", () => {
  it("1. venue inquiry internal note appears with Inquiry provenance", () => {
    const items = buildInternalNotesRollup({
      inquiry: { leadId: "lead-w", body: INQUIRY, origin: "venue", createdAt: "2026-10-03T14:00:00.000Z" },
    });
    assert.equal(items.length, 1);
    assert.equal(items[0]?.kind, "inquiry");
    assert.equal(items[0]?.provenanceLabel, "Inquiry");
    assert.equal(items[0]?.body, INQUIRY);
    assert.equal(items[0]?.canEdit, false);
  });

  it("2. tour internal note appears with Venue Tour provenance", () => {
    const items = buildInternalNotesRollup({
      tours: [{
        id: "tour-1",
        notes: TOUR,
        createdAt: "2026-10-03T15:00:00.000Z",
        completedAt: "2026-10-03T21:11:54.000Z",
      }],
    });
    assert.equal(items.length, 1);
    assert.equal(items[0]?.kind, "tour");
    assert.equal(items[0]?.provenanceLabel, "Venue Tour");
    assert.equal(items[0]?.body, TOUR);
  });

  it("3. direct lead_notes appear as Internal note and remain editable", () => {
    const items = buildInternalNotesRollup({
      leadNotes: [{ id: "n1", body: DIRECT, createdAt: "2026-10-04T12:00:00.000Z" }],
    });
    assert.equal(items[0]?.kind, "lead_note");
    assert.equal(items[0]?.provenanceLabel, "Internal note");
    assert.equal(items[0]?.canEdit, true);
    assert.equal(items[0]?.canDelete, true);
  });

  it("4. inquiry, tour, and direct notes coexist", () => {
    const items = buildInternalNotesRollup({
      inquiry: { leadId: "lead-w", body: INQUIRY, origin: "venue", createdAt: "2026-10-03T14:00:00.000Z" },
      tours: [{ id: "tour-1", notes: TOUR, createdAt: "2026-10-03T15:00:00.000Z", completedAt: "2026-10-03T21:11:54.000Z" }],
      leadNotes: [{ id: "n1", body: DIRECT, createdAt: "2026-10-04T12:00:00.000Z" }],
    });
    assert.equal(items.length, 3);
    assert.deepEqual(items.map((i) => i.kind), ["inquiry", "tour", "lead_note"]);
  });

  it("5–6. ordering is deterministic by occurredAt then kind then id", () => {
    const items = buildInternalNotesRollup({
      leadNotes: [{ id: "n-z", body: "later", createdAt: "2026-10-04T12:00:00.000Z" }],
      inquiry: { leadId: "lead-w", body: INQUIRY, origin: "venue", createdAt: "2026-10-03T14:00:00.000Z" },
      tours: [{ id: "tour-1", notes: TOUR, createdAt: "2026-10-03T15:00:00.000Z", completedAt: "2026-10-03T14:00:00.000Z" }],
    });
    assert.equal(items[0]?.kind, "inquiry");
    assert.equal(items[1]?.kind, "tour");
    assert.equal(items[2]?.kind, "lead_note");
    const resorted = [...items].sort(compareInternalNoteRollup);
    assert.deepEqual(resorted.map((i) => i.id), items.map((i) => i.id));
  });

  it("does not use parent updated_at for inquiry/tour ordering", () => {
    const src = readFileSync(resolve("lib/notes/internal-notes-rollup.ts"), "utf8");
    assert.doesNotMatch(src, /inquiry\.updatedAt|tour\.updatedAt|updated_at/);
  });

  it("7. editing originating inquiry content updates the projection (no copy)", () => {
    const before = buildInternalNotesRollup({
      inquiry: { leadId: "lead-w", body: INQUIRY, origin: "venue", createdAt: "2026-10-03T14:00:00.000Z" },
    });
    const after = buildInternalNotesRollup({
      inquiry: { leadId: "lead-w", body: "Updated inquiry note.", origin: "venue", createdAt: "2026-10-03T14:00:00.000Z" },
    });
    assert.equal(before[0]?.id, after[0]?.id);
    assert.equal(after[0]?.body, "Updated inquiry note.");
  });

  it("8. editing originating tour notes updates the projection", () => {
    const after = buildInternalNotesRollup({
      tours: [{ id: "tour-1", notes: "New tour note.", createdAt: "2026-10-03T15:00:00.000Z", completedAt: "2026-10-03T21:00:00.000Z" }],
    });
    assert.equal(after[0]?.body, "New tour note.");
    assert.equal(after[0]?.id, "tour:tour-1");
    assert.equal(after[0]?.sourceId, "tour-1");
  });

  it("9. clearing an originating note removes it from the rollup", () => {
    const after = buildInternalNotesRollup({
      inquiry: { leadId: "lead-w", body: "  ", origin: "venue", createdAt: "2026-10-03T14:00:00.000Z" },
      tours: [{ id: "tour-1", notes: null, createdAt: "2026-10-03T15:00:00.000Z" }],
      leadNotes: [],
    });
    assert.equal(after.length, 0);
  });

  it("10. customer-origin inquiry is not an Internal Note", () => {
    const items = buildInternalNotesRollup({
      inquiry: { leadId: "lead-w", body: "We love the garden.", origin: "customer", createdAt: "2026-10-03T14:00:00.000Z" },
    });
    assert.equal(items.length, 0);
  });

  it("unknown-origin inquiry is not treated as venue-private", () => {
    const items = buildInternalNotesRollup({
      inquiry: { leadId: "lead-w", body: "Ambiguous notes.", origin: "unknown", createdAt: "2026-10-03T14:00:00.000Z" },
    });
    assert.equal(items.length, 0);
  });

  it("11. reading the rollup does not invent extra copies of the same source id", () => {
    const items = buildInternalNotesRollup({
      inquiry: { leadId: "lead-w", body: INQUIRY, origin: "venue", createdAt: "2026-10-03T14:00:00.000Z" },
      tours: [{ id: "tour-1", notes: TOUR, createdAt: "2026-10-03T15:00:00.000Z", completedAt: "2026-10-03T21:00:00.000Z" }],
    });
    const ids = items.map((i) => i.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("skips public-booking tour notes that echo the customer inquiry", () => {
    assert.equal(tourNotesEchoCustomerInquiry("We love the garden.", "We love the garden.", "customer"), true);
    const items = buildInternalNotesRollup({
      inquiry: { leadId: "lead-w", body: "We love the garden.", origin: "customer", createdAt: "2026-10-03T14:00:00.000Z" },
      tours: [{ id: "tour-1", notes: "We love the garden.", createdAt: "2026-10-03T15:00:00.000Z" }],
    });
    assert.equal(items.length, 0);
  });

  it("12–13. another lead's notes are not included unless passed in", () => {
    const wendy = buildInternalNotesRollup({
      inquiry: { leadId: "lead-w", body: INQUIRY, origin: "venue", createdAt: "2026-10-03T14:00:00.000Z" },
      leadNotes: [{ id: "n1", body: DIRECT, createdAt: "2026-10-04T12:00:00.000Z" }],
    });
    const other = buildInternalNotesRollup({
      inquiry: { leadId: "lead-other", body: OTHER_CLIENT_NOTE, origin: "venue", createdAt: "2026-10-01T12:00:00.000Z" },
    });
    assert.equal(wendy.some((i) => i.body.includes("OTHER-CLIENT")), false);
    assert.equal(other.some((i) => i.body === INQUIRY), false);
  });

  it("includes conversation internal notes and event/client record notes", () => {
    const items = buildInternalNotesRollup({
      conversationNotes: [{ id: "cm1", body: "Staff thread note.", sentAt: "2026-10-03T18:00:00.000Z" }],
      eventNotes: [{ id: "en1", body: "Event workspace note.", createdAt: "2026-10-05T10:00:00.000Z" }],
      clientRecordNotes: { clientId: "c1", body: "Client form internal notes.", createdAt: "2026-10-02T10:00:00.000Z" },
      clientNotes: [{ id: "cn1", body: "Client notes table.", createdAt: "2026-10-06T10:00:00.000Z" }],
    });
    assert.deepEqual(items.map((i) => i.kind), ["client_record", "conversation", "event_note", "client_note"]);
  });

  it("empty sources produce an empty rollup (No notes yet)", () => {
    assert.equal(buildInternalNotesRollup({}).length, 0);
  });
});

describe("Internal Notes rollup must not leak into customer-facing Luv or portal", () => {
  it("16. customer-facing draft prompt still excludes venue inquiry and tour notes", () => {
    const prompt = buildFollowUpPrompt(lead(), "Fancy", "Jen", "warm", {
      proposalSent: false,
      tour: { kind: "completed", scheduledAt: "2026-10-01T18:00:00.000Z", completedAt: "2026-10-02T14:00:00.000Z" },
      communicationPurpose: "none",
    });
    assert.doesNotMatch(prompt, /casino boat|own security|walked in/i);
    assert.match(prompt, /Never invent or allude to venue-internal notes/);
  });

  it("does not wire the rollup into drafts or follow-up tour loader", () => {
    const drafts = readFileSync(resolve("lib/luv/drafts.ts"), "utf8");
    const loader = readFileSync(resolve("lib/luv/follow-up-tour-loader.ts"), "utf8");
    const portal = readFileSync(resolve("lib/conversations/portal-visibility.test.ts"), "utf8");
    assert.doesNotMatch(drafts, /internal-notes-rollup|buildInternalNotesRollup/);
    assert.doesNotMatch(loader, /internal-notes-rollup|buildInternalNotesRollup/);
    assert.match(portal, /internal_note/);
  });

  it("17. venue-facing Luv still synthesizes from tour notes independently of the rollup", () => {
    const copy = venueFacingCompletedTourThoughts("Wendy", TOUR);
    assert.match(copy, /strong interest/i);
    assert.match(copy, /own security/i);
    assert.doesNotMatch(copy, /Your notes:/);
    assert.doesNotMatch(copy, /walked in and we accommodated/);
  });
});
