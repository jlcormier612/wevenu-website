import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, it } from "node:test";

import type { VenueReferralRecord } from "@shared/pricing";

import {
  INTERNAL_REFERRAL_NOTICE_META_KEY,
  buildInternalReferralNoticeText,
  internalReferralNoticeIdempotencyKey,
  notifyInternalReferralSubmitted,
  referralReviewWorkspaceUrl,
  shouldSendInternalReferralNotice,
} from "./notify-internal";

function baseReferral(
  overrides: Partial<VenueReferralRecord> = {},
): VenueReferralRecord {
  return {
    id: "ref-11111111-1111-1111-1111-111111111111",
    referringVenueId: "venue-referrer",
    referringOrganizationId: null,
    submittedByUserId: "user-1",
    submittedByEmail: "owner@example.com",
    referredVenueName: "Cedar Hollow Estate",
    referredCity: "Austin",
    referredState: "TX",
    referredWebsite: "https://cedar.example",
    referredWebsiteDomain: "cedar.example",
    referredContactEmail: "hello@cedar.example",
    referredContactName: "Sam Cedar",
    referredContactRole: "Owner",
    notes: null,
    status: "submitted",
    assignedOwnerEmail: null,
    linkedRelationshipId: null,
    linkedVenueId: null,
    isSelfReferral: false,
    isSameOrganization: false,
    isExistingPayingCustomer: false,
    isDuplicateClaim: false,
    blockedReason: null,
    programPolicyVersion: "v1",
    qualificationDays: 30,
    audit: [],
    metadata: {},
    createdAt: "2026-11-12T12:00:00.000Z",
    updatedAt: "2026-11-12T12:00:00.000Z",
    ...overrides,
  };
}

describe("internal referral founder notice", () => {
  const originalWorkspace = process.env.WORKSPACE_URL;

  beforeEach(() => {
    process.env.WORKSPACE_URL = "https://workspace.sandbox.hellotocheers.com";
  });

  afterEach(() => {
    process.env.WORKSPACE_URL = originalWorkspace;
  });

  it("builds review link and body without prospect contact details", () => {
    const url = referralReviewWorkspaceUrl("ref-abc");
    assert.equal(
      url,
      "https://workspace.sandbox.hellotocheers.com/referrals?referralId=ref-abc",
    );

    // Venue-app Sandbox often lacks WORKSPACE_URL — derive from app host.
    const prevWs = process.env.WORKSPACE_URL;
    const prevApp = process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.WORKSPACE_URL;
    delete process.env.NEXT_PUBLIC_WORKSPACE_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://app.sandbox.hellotocheers.com";
    assert.equal(
      referralReviewWorkspaceUrl("ref-abc"),
      "https://workspace.sandbox.hellotocheers.com/referrals?referralId=ref-abc",
    );
    process.env.WORKSPACE_URL = prevWs;
    process.env.NEXT_PUBLIC_APP_URL = prevApp;
    assert.equal(
      internalReferralNoticeIdempotencyKey("ref-abc"),
      "referral-internal-notice:v1:ref-abc",
    );

    const text = buildInternalReferralNoticeText({
      referringVenueName: "Willow Grove",
      referredVenueName: "Cedar Hollow Estate",
      submittedAt: "2026-11-12T12:00:00.000Z",
      reviewUrl: url,
      status: "submitted",
    });
    assert.match(text, /Referring venue: Willow Grove/);
    assert.match(text, /Referred venue: Cedar Hollow Estate/);
    assert.match(text, /Submitted: 2026-11-12T12:00:00.000Z/);
    assert.match(text, /Review: https:\/\/workspace\.sandbox\.hellotocheers\.com\/referrals\?referralId=ref-abc/);
    assert.doesNotMatch(text, /hello@cedar\.example/);
    assert.match(text, /Do not contact the referred venue/);
  });

  it("skips closed_duplicate and already-notified referrals", () => {
    assert.equal(shouldSendInternalReferralNotice(baseReferral()).ok, true);

    const dup = shouldSendInternalReferralNotice(
      baseReferral({ status: "closed_duplicate" }),
    );
    assert.equal(dup.ok, false);
    if (!dup.ok) assert.equal(dup.reason, "closed_duplicate");

    const again = shouldSendInternalReferralNotice(
      baseReferral({
        metadata: {
          [INTERNAL_REFERRAL_NOTICE_META_KEY]: "2026-11-12T12:01:00.000Z",
        },
      }),
    );
    assert.equal(again.ok, false);
    if (!again.ok) assert.equal(again.reason, "already_notified");
  });

  it("sends via ops notify with idempotency key and never prospects", async () => {
    const calls: Array<{
      subject: string;
      text: string;
      idempotencyKey?: string;
    }> = [];
    const result = await notifyInternalReferralSubmitted({
      referral: baseReferral(),
      referringVenueName: "Willow Grove",
      sendOps: async (input) => {
        calls.push(input);
        return {
          ok: true,
          delivery: "simulated",
          to: "jennifer@hellotocheers.com",
        };
      },
    });

    assert.equal(result.sent, true);
    assert.equal(calls.length, 1);
    assert.equal(
      calls[0].idempotencyKey,
      "referral-internal-notice:v1:ref-11111111-1111-1111-1111-111111111111",
    );
    assert.match(calls[0].subject, /Cedar Hollow Estate/);
    assert.match(calls[0].text, /Willow Grove/);
    assert.doesNotMatch(calls[0].text, /hello@cedar\.example/);
    assert.doesNotMatch(calls[0].subject, /hello@cedar\.example/);
  });

  it("does not send on duplicate / already-notified", async () => {
    const calls: unknown[] = [];
    const skipped = await notifyInternalReferralSubmitted({
      referral: baseReferral({
        metadata: {
          [INTERNAL_REFERRAL_NOTICE_META_KEY]: "2026-11-12T12:01:00.000Z",
        },
      }),
      referringVenueName: "Willow Grove",
      sendOps: async (input) => {
        calls.push(input);
        return { ok: true, delivery: "sent", to: "jennifer@hellotocheers.com" };
      },
    });
    assert.equal(skipped.sent, false);
    if (!skipped.sent) assert.equal(skipped.reason, "already_notified");
    assert.equal(calls.length, 0);
  });

  it("surfaces send failure without throwing", async () => {
    const result = await notifyInternalReferralSubmitted({
      referral: baseReferral(),
      referringVenueName: "Willow Grove",
      sendOps: async () => ({
        ok: false,
        delivery: "failed",
        message: "provider down",
        to: "jennifer@hellotocheers.com",
      }),
    });
    assert.equal(result.sent, false);
    if (!result.sent) assert.equal(result.reason, "send_failed");
  });

  it("API route wires founder notice after successful submit and marks metadata", () => {
    const route = readFileSync("app/api/referrals/route.ts", "utf8");
    assert.match(route, /notifyInternalReferralSubmitted/);
    assert.match(route, /INTERNAL_REFERRAL_NOTICE_META_KEY/);
    assert.match(route, /internal_founder_notice_sent/);
    assert.doesNotMatch(
      route,
      /sendEmail\(\{[\s\S]*referredContactEmail/,
    );
  });

  it("preserves Share the Luv confirmation copy in submitVenueReferral", () => {
    const service = readFileSync("shared/pricing/referral-service.ts", "utf8");
    assert.match(service, /Thanks for sharing the Luv!/);
    assert.match(
      service,
      /Do NOT auto-email the prospect\. Confirmation is in-app only here\./,
    );
  });

  it("workspace referrals remain permission-gated", () => {
    const perms = readFileSync("workspace/lib/program4/permissions.ts", "utf8");
    assert.match(perms, /"\/referrals": "manage_product_sync"/);
  });
});
