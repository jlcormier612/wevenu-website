/**
 * P-A1 unattended inquiry — locked eligibility definition.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import { isVenueStaffFirstResponseMessage } from "@/lib/luv/observation-quality";
import { evaluateUnattendedInquiryPattern } from "@/lib/luv/spot-patterns";
import {
  hasVenueFirstResponseEvidence,
  isCustomerOriginInquiry,
  isQualifyingUnattendedInquiry,
  isUnattendedInquiryCreatedAtWindow,
  uniqueQualifyingUnattendedInquiryIds,
  UNATTENDED_INQUIRY_CTA_LABEL,
  UNATTENDED_INQUIRY_LEADS_HREF,
  type UnattendedInquiryEvidence,
} from "@/lib/luv/unattended-inquiry";
import { buildS3UnattendedInquiryObservation } from "@/lib/luv/contextual-signals";

const VENUE = "venue-a";
const NOW = Date.parse("2026-09-30T15:00:00.000Z");

function hoursAgo(hours: number): string {
  return new Date(NOW - hours * 3_600_000).toISOString();
}

function lead(overrides: Partial<UnattendedInquiryEvidence> = {}): UnattendedInquiryEvidence {
  return {
    id: overrides.id ?? "L1",
    venueId: overrides.venueId ?? VENUE,
    createdAt: overrides.createdAt ?? hoursAgo(72),
    inquiryMessageOrigin: overrides.inquiryMessageOrigin ?? "customer",
    firstBookedAt: overrides.firstBookedAt ?? null,
    lostAt: overrides.lostAt ?? null,
    lastContactedAt: overrides.lastContactedAt ?? null,
    hasVenueStaffOutbound: overrides.hasVenueStaffOutbound ?? false,
    tourStatus: overrides.tourStatus ?? null,
    tourOrigin: overrides.tourOrigin ?? null,
    relationshipId: overrides.relationshipId === undefined ? "rel-1" : overrides.relationshipId,
    ...overrides,
  };
}

function clusterLead(id: string, overrides: Partial<UnattendedInquiryEvidence> = {}) {
  const e = lead({ id, ...overrides });
  return {
    ...e,
    firstName: "Pat",
    lastName: id,
    salesStage: "new_inquiry",
    acquisitionSource: e.acquisitionSource,
  };
}

describe("inquiry authorship", () => {
  it("empty message + unknown origin → NO", () => {
    assert.equal(isCustomerOriginInquiry("unknown"), false);
    assert.equal(
      isQualifyingUnattendedInquiry(lead({ inquiryMessageOrigin: "unknown" }), { venueId: VENUE, nowMs: NOW }),
      false,
    );
  });
  it("unknown origin + text → NO", () => {
    assert.equal(
      isQualifyingUnattendedInquiry(lead({ inquiryMessageOrigin: "unknown" }), { venueId: VENUE, nowMs: NOW }),
      false,
    );
  });
  it("venue origin + text → NO", () => {
    assert.equal(
      isQualifyingUnattendedInquiry(lead({ inquiryMessageOrigin: "venue" }), { venueId: VENUE, nowMs: NOW }),
      false,
    );
  });
  it("customer origin + empty message → YES", () => {
    assert.equal(
      isQualifyingUnattendedInquiry(lead({ inquiryMessageOrigin: "customer" }), { venueId: VENUE, nowMs: NOW }),
      true,
    );
  });
  it("customer origin + relationship_id null → can qualify", () => {
    assert.equal(
      isQualifyingUnattendedInquiry(lead({ relationshipId: null }), { venueId: VENUE, nowMs: NOW }),
      true,
    );
  });
});

describe("contact evidence", () => {
  it("customer-origin inquiry + no contact → YES", () => {
    assert.equal(isQualifyingUnattendedInquiry(lead(), { venueId: VENUE, nowMs: NOW }), true);
  });
  it("customer-facing venue staff message → NO", () => {
    assert.equal(
      isQualifyingUnattendedInquiry(lead({ hasVenueStaffOutbound: true }), { venueId: VENUE, nowMs: NOW }),
      false,
    );
  });
  it("customer inbound only → can remain P-A1", () => {
    assert.equal(
      isVenueStaffFirstResponseMessage({ senderType: "lead_or_client", channel: "email" }),
      false,
    );
    assert.equal(
      isQualifyingUnattendedInquiry(lead({ hasVenueStaffOutbound: false }), { venueId: VENUE, nowMs: NOW }),
      true,
    );
  });
  it("internal note only does not satisfy first response", () => {
    assert.equal(
      isVenueStaffFirstResponseMessage({ senderType: "venue_staff", channel: "internal_note" }),
      false,
    );
  });
  it("system outbound only does not satisfy first response", () => {
    assert.equal(
      isVenueStaffFirstResponseMessage({ senderType: "system", channel: "email" }),
      false,
    );
    assert.equal(
      isQualifyingUnattendedInquiry(lead({ hasVenueStaffOutbound: false }), { venueId: VENUE, nowMs: NOW }),
      true,
    );
  });
  it("last_contacted_at populated → NO", () => {
    assert.equal(
      isQualifyingUnattendedInquiry(lead({ lastContactedAt: hoursAgo(1) }), { venueId: VENUE, nowMs: NOW }),
      false,
    );
  });
  it("last_contacted_at null despite staff message → still excluded", () => {
    assert.equal(
      hasVenueFirstResponseEvidence({
        lastContactedAt: null,
        hasVenueStaffOutbound: true,
        tourStatus: null,
      }),
      true,
    );
    assert.equal(
      isQualifyingUnattendedInquiry(
        lead({ lastContactedAt: null, hasVenueStaffOutbound: true }),
        { venueId: VENUE, nowMs: NOW },
      ),
      false,
    );
  });
  for (const status of ["completed", "scheduled", "confirmed", "cancelled", "no_show"] as const) {
    it(`${status} tour → NO`, () => {
      assert.equal(
        isQualifyingUnattendedInquiry(lead({ tourStatus: status }), { venueId: VENUE, nowMs: NOW }),
        false,
      );
    });
  }
  it("walk-in completed → NO", () => {
    assert.equal(
      isQualifyingUnattendedInquiry(
        lead({ tourStatus: "completed", tourOrigin: "walk_in" }),
        { venueId: VENUE, nowMs: NOW },
      ),
      false,
    );
  });
});

describe("booking / lost", () => {
  it("first_booked_at populated → NO", () => {
    assert.equal(
      isQualifyingUnattendedInquiry(lead({ firstBookedAt: hoursAgo(10) }), { venueId: VENUE, nowMs: NOW }),
      false,
    );
  });
  it("lost_at populated → NO", () => {
    assert.equal(
      isQualifyingUnattendedInquiry(lead({ lostAt: hoursAgo(10) }), { venueId: VENUE, nowMs: NOW }),
      false,
    );
  });
  it("sales_stage booked + no first_booked_at + unknown origin → NO", () => {
    assert.equal(
      isQualifyingUnattendedInquiry(lead({ inquiryMessageOrigin: "unknown" }), { venueId: VENUE, nowMs: NOW }),
      false,
    );
  });
  it("sales_stage booked is not a fallback — customer origin can still qualify", () => {
    const row = clusterLead("b1");
    row.salesStage = "booked";
    assert.equal(
      isQualifyingUnattendedInquiry(row, { venueId: VENUE, nowMs: NOW }),
      true,
    );
  });
});

describe("age window (created_at)", () => {
  it("47h59m → NO", () => {
    const createdAt = new Date(NOW - (47 * 3_600_000 + 59 * 60_000)).toISOString();
    assert.equal(isUnattendedInquiryCreatedAtWindow(createdAt, { nowMs: NOW, maxDays: 14 }), false);
    assert.equal(
      isQualifyingUnattendedInquiry(lead({ createdAt }), { venueId: VENUE, nowMs: NOW }),
      false,
    );
  });
  it("exactly 48h → YES", () => {
    assert.equal(
      isQualifyingUnattendedInquiry(lead({ createdAt: hoursAgo(48) }), { venueId: VENUE, nowMs: NOW }),
      true,
    );
  });
  it("exactly 14d → YES", () => {
    assert.equal(
      isQualifyingUnattendedInquiry(
        lead({ createdAt: new Date(NOW - 14 * 86_400_000).toISOString() }),
        { venueId: VENUE, nowMs: NOW },
      ),
      true,
    );
  });
  it(">14d → NO for cluster; S3 observation window still YES", () => {
    const createdAt = new Date(NOW - 14 * 86_400_000 - 1).toISOString();
    assert.equal(
      isQualifyingUnattendedInquiry(lead({ createdAt }), { venueId: VENUE, nowMs: NOW, window: "cluster" }),
      false,
    );
    assert.equal(
      isQualifyingUnattendedInquiry(lead({ createdAt }), { venueId: VENUE, nowMs: NOW, window: "observation" }),
      true,
    );
  });
});

describe("cluster", () => {
  it("two final qualifiers → no pattern", () => {
    assert.equal(
      evaluateUnattendedInquiryPattern([clusterLead("a"), clusterLead("b")], {
        venueId: VENUE,
        nowMs: NOW,
        venueLeadHistoryCount: 20,
      }),
      null,
    );
  });
  it("three final qualifiers → pattern", () => {
    const rec = evaluateUnattendedInquiryPattern(
      [clusterLead("a"), clusterLead("b"), clusterLead("c")],
      { venueId: VENUE, nowMs: NOW, venueLeadHistoryCount: 20 },
    );
    assert.ok(rec);
    assert.deepEqual(rec!.metadata.lead_ids, ["a", "b", "c"]);
  });
  it("three candidates with one invalid origin → no pattern", () => {
    assert.equal(
      evaluateUnattendedInquiryPattern(
        [
          clusterLead("a"),
          clusterLead("b"),
          clusterLead("c", { inquiryMessageOrigin: "venue" }),
        ],
        { venueId: VENUE, nowMs: NOW, venueLeadHistoryCount: 20 },
      ),
      null,
    );
  });
  it("three candidates with one completed tour → no pattern", () => {
    assert.equal(
      evaluateUnattendedInquiryPattern(
        [
          clusterLead("a"),
          clusterLead("b"),
          clusterLead("c", { tourStatus: "completed" }),
        ],
        { venueId: VENUE, nowMs: NOW, venueLeadHistoryCount: 20 },
      ),
      null,
    );
  });
  it("three candidates with one booked stamp → no pattern", () => {
    assert.equal(
      evaluateUnattendedInquiryPattern(
        [
          clusterLead("a"),
          clusterLead("b"),
          clusterLead("c", { firstBookedAt: hoursAgo(3) }),
        ],
        { venueId: VENUE, nowMs: NOW, venueLeadHistoryCount: 20 },
      ),
      null,
    );
  });
  it("cluster count uses unique final qualifying lead IDs", () => {
    const ids = uniqueQualifyingUnattendedInquiryIds(
      [lead({ id: "a" }), lead({ id: "a" }), lead({ id: "b" }), lead({ id: "c" })],
      { venueId: VENUE, nowMs: NOW },
    );
    assert.deepEqual(ids, ["a", "b", "c"]);
  });
  it("website clause uses only the final qualifying population", () => {
    const rec = evaluateUnattendedInquiryPattern(
      [
        clusterLead("a", { acquisitionSource: "website" }),
        clusterLead("b", { acquisitionSource: "website" }),
        clusterLead("c", { acquisitionSource: "website" }),
        clusterLead("skip", { inquiryMessageOrigin: "unknown", acquisitionSource: "website" }),
      ],
      { venueId: VENUE, nowMs: NOW, venueLeadHistoryCount: 20 },
    );
    assert.ok(rec);
    assert.match(rec!.body, /Most came from your website/);
    assert.equal(rec!.metadata.lead_count, 3);
  });
});

describe("CTA + destination", () => {
  it("stores qualifying IDs and the dedicated population href", () => {
    const rec = evaluateUnattendedInquiryPattern(
      [clusterLead("a"), clusterLead("b"), clusterLead("c")],
      { venueId: VENUE, nowMs: NOW, venueLeadHistoryCount: 20 },
    );
    assert.ok(rec);
    assert.equal(rec!.ctas[0].label, UNATTENDED_INQUIRY_CTA_LABEL);
    assert.equal(rec!.ctas[0].target, UNATTENDED_INQUIRY_LEADS_HREF);
    assert.deepEqual(rec!.metadata.lead_ids, ["a", "b", "c"]);
    const list = readFileSync(resolve("components/leads/lead-list.tsx"), "utf8");
    assert.match(list, /unattendedInquiryLeadIds/);
    assert.doesNotMatch(list, /attention=unseen.*unattended/);
    const page = readFileSync(resolve("app/(app)/leads/page.tsx"), "utf8");
    assert.match(page, /getUnattendedInquiryLeadIdsForCurrentVenue/);
    const loader = readFileSync(resolve("lib/luv/unattended-inquiry-population.ts"), "utf8");
    assert.match(loader, /loadQualifyingUnattendedInquiryLeadIds/);
    const contact = readFileSync(resolve("lib/luv/unattended-inquiry-contact.ts"), "utf8");
    assert.match(contact, /isQualifyingUnattendedInquiry/);
  });
});

describe("privacy", () => {
  it("does not import Internal Notes into customer-facing drafts", () => {
    const drafts = readFileSync(resolve("lib/luv/drafts.ts"), "utf8");
    const evalSrc = readFileSync(resolve("lib/luv/unattended-inquiry.ts"), "utf8");
    assert.doesNotMatch(drafts, /buildInternalNotesRollup|internal-notes-rollup/);
    assert.doesNotMatch(evalSrc, /buildInternalNotesRollup|internal-notes-rollup/);
  });
  it("S3 reached-out language is gated on customer origin", () => {
    assert.equal(
      buildS3UnattendedInquiryObservation(
        {
          id: "x",
          venueId: VENUE,
          firstName: "Pat",
          lastName: "Unknown",
          salesStage: "new_inquiry",
          createdAt: hoursAgo(72),
          lastContactedAt: null,
          inquiryMessageOrigin: "unknown",
        },
        { venueId: VENUE, nowMs: NOW },
      ),
      null,
    );
  });
});
