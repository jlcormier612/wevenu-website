/**
 * Legacy followup-* Noticed card: first-response eligibility + prospect recency.
 * Betty-class: active tour reschedule + venue_staff exchange must not urge follow-up.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import { buildLegacyNoFollowUpObservation } from "@/lib/luv/contextual-signals";
import {
  isProspectInboundActivityMessage,
} from "@/lib/luv/unattended-inquiry-contact";

const VENUE = "venue-a";
const NOW = Date.parse("2026-10-16T01:00:00.000Z");
const TWO_DAYS_AGO = new Date(NOW - 2 * 86_400_000).toISOString();
const FIVE_DAYS_AGO = new Date(NOW - 5 * 86_400_000).toISOString();
const ONE_DAY_AGO = new Date(NOW - 1 * 86_400_000).toISOString();
const MINUTES_AGO = new Date(NOW - 5 * 60_000).toISOString();

function lead(
  overrides: Partial<Parameters<typeof buildLegacyNoFollowUpObservation>[0]> = {},
) {
  return {
    id: "L1",
    venueId: VENUE,
    firstName: "Betty",
    lastName: "Boop",
    createdAt: TWO_DAYS_AGO,
    lastContactedAt: null,
    hasVenueStaffOutbound: false,
    tourStatus: null,
    tourOrigin: null,
    latestProspectActivityAt: null,
    ...overrides,
  };
}

describe("legacy no-follow-up freshness (followup-*)", () => {
  it("old inquiry + recent inbound uses inbound recency, still eligible", () => {
    const obs = buildLegacyNoFollowUpObservation(
      lead({
        createdAt: FIVE_DAYS_AGO,
        latestProspectActivityAt: ONE_DAY_AGO,
      }),
      { venueId: VENUE, nowMs: NOW },
    );
    assert.ok(obs);
    assert.equal(obs!.id, "followup-L1");
    assert.match(obs!.message, /reached out 1 day ago/);
    assert.doesNotMatch(obs!.message, /5 days ago/);
    assert.equal(obs!.recommendation?.type, "draft");
  });

  it("recent inbound + venue_staff outbound (tour reschedule) suppresses follow-up urge", () => {
    const obs = buildLegacyNoFollowUpObservation(
      lead({
        createdAt: TWO_DAYS_AGO,
        latestProspectActivityAt: MINUTES_AGO,
        hasVenueStaffOutbound: true,
      }),
      { venueId: VENUE, nowMs: NOW },
    );
    assert.equal(obs, null);
  });

  it("active tour contact suppresses follow-up even when last_contacted_at is null", () => {
    assert.equal(
      buildLegacyNoFollowUpObservation(
        lead({
          lastContactedAt: null,
          tourStatus: "confirmed",
          tourOrigin: "scheduled",
          latestProspectActivityAt: MINUTES_AGO,
        }),
        { venueId: VENUE, nowMs: NOW },
      ),
      null,
    );
    assert.equal(
      buildLegacyNoFollowUpObservation(
        lead({ tourStatus: "cancelled", tourOrigin: "scheduled" }),
        { venueId: VENUE, nowMs: NOW },
      ),
      null,
    );
  });

  it("genuinely stale unattended inquiry remains eligible with created_at recency", () => {
    const obs = buildLegacyNoFollowUpObservation(
      lead({
        firstName: "Stale",
        lastName: "Lead",
        createdAt: FIVE_DAYS_AGO,
        latestProspectActivityAt: null,
      }),
      { venueId: VENUE, nowMs: NOW },
    );
    assert.ok(obs);
    assert.match(obs!.message, /Stale Lead reached out 5 days ago/);
    assert.match(obs!.recommendation!.label, /Ask Luv to draft a follow-up/);
  });

  it("preserves message direction: inbound advances recency; venue outbound is eligibility only", () => {
    assert.equal(
      isProspectInboundActivityMessage({ senderType: "lead_or_client", channel: "email" }),
      true,
    );
    assert.equal(
      isProspectInboundActivityMessage({ senderType: "venue_staff", channel: "email" }),
      false,
    );
    assert.equal(
      isProspectInboundActivityMessage({ senderType: "system", channel: "email" }),
      false,
    );
    // Venue outbound suppresses — does not become “they reached out just now.”
    const suppressed = buildLegacyNoFollowUpObservation(
      lead({
        createdAt: FIVE_DAYS_AGO,
        hasVenueStaffOutbound: true,
        latestProspectActivityAt: null,
      }),
      { venueId: VENUE, nowMs: NOW },
    );
    assert.equal(suppressed, null);
    // Inbound alone does not invent venue contact.
    const stillOpen = buildLegacyNoFollowUpObservation(
      lead({
        createdAt: FIVE_DAYS_AGO,
        hasVenueStaffOutbound: false,
        latestProspectActivityAt: MINUTES_AGO,
      }),
      { venueId: VENUE, nowMs: NOW },
    );
    assert.ok(stillOpen);
    assert.match(stillOpen!.message, /reached out earlier today/);
  });

  it("observations engine loads contact evidence for legacy followup rows", () => {
    const src = readFileSync(resolve("lib/luv/observations.ts"), "utf8");
    assert.match(src, /buildLegacyNoFollowUpObservation/);
    assert.match(src, /loadUnattendedInquiryContactEvidence/);
    assert.match(src, /latestProspectActivityAt/);
    assert.match(src, /relationship_id/);
  });

  it("lead conversation send refreshes the page so Luv Noticed recomputes", () => {
    const detail = readFileSync(resolve("components/leads/lead-detail.tsx"), "utf8");
    assert.match(detail, /handleAuthoritativeConversationSendSuccess/);
    assert.match(detail, /router\.refresh\(\)/);
    assert.match(
      detail,
      /onAuthoritativeSendSuccess=\{handleAuthoritativeConversationSendSuccess\}/,
    );
  });

  it("other valid recommendations keep draft CTA shape (S3 / followup label contract)", () => {
    const obs = buildLegacyNoFollowUpObservation(lead(), { venueId: VENUE, nowMs: NOW });
    assert.ok(obs);
    assert.equal(obs!.recommendation?.link, "/leads/L1?luv=follow_up_email");
    assert.equal(obs!.kind, "risk");
  });
});
