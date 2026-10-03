import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  TEXTING_HOW_YOU_KNOW_READY,
  TEXTING_SETUP_GUIDE_HREF,
  TEXTING_SETUP_GUIDE_SLUG,
  TEXTING_WHAT_HTC_HANDLES,
  TEXTING_WHAT_IT_ENABLES,
  TEXTING_WHY_WE_COLLECT,
  answerTextingSetupLuvQuestion,
  buildTextingPhaseStory,
  buildTextingSetupLuvContext,
  collectTextingHumanFacingCopy,
  textingDisplayHeadline,
  textingLuvSuggestions,
} from "@/lib/texting-registration/human-facing";
import {
  assertNoProviderLeak,
  buildTextingStatusPanel,
  impliesProviderRegistrationPending,
} from "@/lib/texting-registration/status-panel";
import { TEXTING_PHASES, type TextingPhase, type TextingRegistrationView } from "@/lib/texting-registration/types";
import { INTEGRATION_SETUP_ARTICLES } from "@/lib/help-guides/integration-setup-articles";

function sampleView(overrides: Partial<TextingRegistrationView> = {}): TextingRegistrationView {
  return {
    venueId: "a415ac52-cd74-42a6-8df7-7a8f6e71d080",
    phase: "details_needed",
    attentionCode: null,
    attentionMessage: null,
    attentionFixHint: null,
    businessName: "Fancy Venue LLC",
    websiteUrl: "https://example.com",
    addressLine1: "123 Main St",
    addressLine2: null,
    city: "Austin",
    stateRegion: "TX",
    postalCode: "78701",
    country: "United States",
    contactEmail: "owner@example.com",
    contactPhone: "+15551234567",
    businessConfirmedAt: new Date().toISOString(),
    businessType: "llc",
    businessIndustry: "HOSPITALITY",
    registrationIdType: "EIN",
    hasRegistrationNumber: true,
    registrationNumberLast4: "6789",
    regionsOfOperation: "USA_AND_CANADA",
    repFirstName: "Jen",
    repLastName: "Owner",
    repEmail: "jen@example.com",
    repPhone: "+15551234567",
    repBusinessTitle: "Owner",
    repJobPosition: "ceo",
    messagingPurpose: "Booking questions",
    sampleMessage1: "Hi — confirming your tour.",
    sampleMessage2: null,
    optInDescription: "They check a text-permission box.",
    privacyPolicyUrl: "https://example.com/privacy",
    termsUrl: "https://example.com/terms",
    submittedAt: null,
    approvedAt: null,
    lastSyncedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function panelFor(
  phase: TextingPhase,
  opts: { smsReady?: boolean; e164?: string | null } = {},
) {
  return buildTextingStatusPanel({
    registration: sampleView({
      phase,
      attentionMessage:
        phase === "needs_attention"
          ? "Additional business information is required."
          : phase === "failed"
            ? "Texting setup ran into a problem."
            : null,
      attentionFixHint:
        phase === "needs_attention" || phase === "failed"
          ? "Update the highlighted details, then resubmit."
          : null,
    }),
    phase,
    smsReady: opts.smsReady ?? false,
    textingNumberE164: opts.e164 === undefined ? null : opts.e164,
  });
}

const UNSUPPORTED_CLAIM =
  /\bETA\b|within \d+ (days|hours)|usually takes|carrier (approval|review)|awaiting approval|under review with|A2P|10DLC|Twilio|Trust Hub|Account SID|Auth Token/i;

describe("texting human-facing explanation per display state", () => {
  for (const phase of TEXTING_PHASES) {
    it(`explains what happened / next / owner action for ${phase}`, () => {
      const panel = panelFor(phase, {
        smsReady: phase === "ready",
        e164: phase === "ready" || phase === "paused" ? "+15551112222" : null,
      });
      const story = buildTextingPhaseStory(panel);
      assert.equal(story.phase, phase);
      assert.ok(story.whatHappened.length > 10);
      assert.ok(story.whatHappensNext.length > 10);
      assert.ok(story.ownerNeedsToDo.length > 5);
      assertNoProviderLeak(collectTextingHumanFacingCopy(panel));
      assert.equal(UNSUPPORTED_CLAIM.test(collectTextingHumanFacingCopy(panel)), false);
    });
  }

  it("information_saved: saved, HTC working, no number, not ready, no owner action", () => {
    const panel = panelFor("information_saved", { smsReady: false, e164: null });
    const story = buildTextingPhaseStory(panel);
    assert.match(story.whatHappened, /received and saved/i);
    assert.match(story.whatHappened, /working through/i);
    assert.match(story.whatHappensNext, /No texting number has been assigned yet/i);
    assert.match(story.whatHappensNext, /not ready/i);
    assert.match(story.ownerNeedsToDo, /No action is required/i);
    assert.equal(panel.smsReady, false);
    assert.equal(panel.textingNumber.e164, null);
    assert.equal(textingDisplayHeadline(panel), "Setting up");
    assert.equal(impliesProviderRegistrationPending(story.whatHappened), false);
    assert.equal(impliesProviderRegistrationPending(story.whatHappensNext), false);
    assert.doesNotMatch(story.whatHappened + story.whatHappensNext, /carrier|approved|approval|ETA|days/i);
  });

  it("never claims a number without authoritative E.164", () => {
    for (const phase of TEXTING_PHASES) {
      const panel = panelFor(phase, { smsReady: false, e164: null });
      const copy = collectTextingHumanFacingCopy(panel);
      assert.doesNotMatch(copy, /Your (assigned )?texting number is/i);
      assert.match(
        buildTextingPhaseStory(panel).whatHappensNext
          + (phase === "information_saved" || phase === "under_review" || phase === "setting_up_number"
            ? " No texting number"
            : ""),
        /./,
      );
      if (phase === "information_saved") {
        assert.match(buildTextingPhaseStory(panel).whatHappensNext, /No texting number has been assigned yet/);
      }
    }
  });

  it("claims a number only when E.164 is present", () => {
    const panel = panelFor("ready", { smsReady: true, e164: "+15559876543" });
    const story = buildTextingPhaseStory(panel);
    assert.match(story.whatHappened, /987/);
    const ctx = buildTextingSetupLuvContext({ panel, canEdit: false });
    assert.equal(ctx.hasE164Number, true);
    assert.match(answerTextingSetupLuvQuestion("What's my number?", ctx), /987/);
  });

  it("never claims send-ready without smsReady", () => {
    const panel = panelFor("information_saved", { smsReady: false, e164: null });
    const ctx = buildTextingSetupLuvContext({ panel, canEdit: true });
    const answer = answerTextingSetupLuvQuestion("Is texting ready?", ctx);
    assert.match(answer, /not ready/i);
    assert.doesNotMatch(answer, /is ready to send/i);
    assert.equal(ctx.smsReady, false);
  });

  it("claims send-ready only when smsReady is true", () => {
    const panel = panelFor("ready", { smsReady: true, e164: "+15551112222" });
    const ctx = buildTextingSetupLuvContext({ panel, canEdit: false });
    assert.match(answerTextingSetupLuvQuestion("Is texting ready?", ctx), /ready to send/i);
  });
});

describe("texting Ask Luv grounded context", () => {
  it("Luv context uses only authoritative panel fields", () => {
    const panel = panelFor("information_saved", { smsReady: false, e164: null });
    const ctx = buildTextingSetupLuvContext({ panel, canEdit: true });
    assert.equal(ctx.phase, "information_saved");
    assert.equal(ctx.displayHeadline, "Setting up");
    assert.equal(ctx.smsReady, false);
    assert.equal(ctx.hasE164Number, false);
    assert.equal(ctx.textingNumberE164, null);
    assert.equal(ctx.canResubmit, panel.canResubmit);
    assert.equal(ctx.canEdit, true);
    assert.equal(ctx.messagingRegistrationLabel, panel.messagingRegistration.label);
  });

  it("Luv refuses invented ETA / carrier claims for information_saved", () => {
    const panel = panelFor("information_saved", { smsReady: false, e164: null });
    const ctx = buildTextingSetupLuvContext({ panel, canEdit: true });
    const eta = answerTextingSetupLuvQuestion("What's the ETA for carrier approval?", ctx);
    assert.match(eta, /don.?t invent|not ready yet|no timeline/i);
    assert.doesNotMatch(eta, /\b\d+ days\b|approved|A2P|Twilio/i);
    assertNoProviderLeak(eta);
  });

  it("Luv status answer stays grounded for information_saved", () => {
    const panel = panelFor("information_saved", { smsReady: false, e164: null });
    const ctx = buildTextingSetupLuvContext({ panel, canEdit: true });
    const answer = answerTextingSetupLuvQuestion("What's my texting status?", ctx);
    assert.match(answer, /Setting up/);
    assert.match(answer, /No texting number is assigned yet/);
    assert.match(answer, /not ready to send yet/i);
    assert.match(answer, /No action is required/i);
    assertNoProviderLeak(answer);
  });

  it("Luv explains update path when attention is required", () => {
    const panel = panelFor("needs_attention", { smsReady: false, e164: null });
    const ctx = buildTextingSetupLuvContext({ panel, canEdit: true });
    assert.ok(textingLuvSuggestions(ctx).some((s) => s.id === "update"));
    const answer = answerTextingSetupLuvQuestion("Where do I update my information?", ctx);
    assert.match(answer, /Update details & resubmit/);
    assertNoProviderLeak(answer);
  });

  it("orientation constants are customer-safe", () => {
    for (const text of [
      TEXTING_WHAT_IT_ENABLES,
      TEXTING_WHY_WE_COLLECT,
      TEXTING_WHAT_HTC_HANDLES,
      TEXTING_HOW_YOU_KNOW_READY,
    ]) {
      assertNoProviderLeak(text);
      assert.equal(UNSUPPORTED_CLAIM.test(text), false);
    }
  });
});

describe("texting setup help link + Ask Luv entry in UI", () => {
  it("help article exists and matches SetupGuideLink slug", () => {
    assert.equal(TEXTING_SETUP_GUIDE_HREF, `/help/${TEXTING_SETUP_GUIDE_SLUG}`);
    const article = INTEGRATION_SETUP_ARTICLES.find((a) => a.slug === TEXTING_SETUP_GUIDE_SLUG);
    assert.ok(article);
    assertNoProviderLeak(article!.body);
  });

  it("Text messaging setup section includes guide link and Ask Luv entry", () => {
    const source = readFileSync(
      resolve("components/settings/text-messaging-setup-section.tsx"),
      "utf8",
    );
    assert.match(source, /SetupGuideLink/);
    assert.match(source, /TEXTING_SETUP_GUIDE_HREF/);
    assert.match(source, /TextingSetupAskLuv/);
    assert.match(source, /texting-setup-orientation/);
    assert.match(source, /Communication Health/);
    assert.doesNotMatch(source, /\bTwilio\b|\bA2P\b|\b10DLC\b/);
  });

  it("Ask Luv component uses grounded answer helper", () => {
    const source = readFileSync(
      resolve("components/settings/texting-setup-ask-luv.tsx"),
      "utf8",
    );
    assert.match(source, /answerTextingSetupLuvQuestion/);
    assert.match(source, /texting-ask-luv-toggle/);
    assert.match(source, /Ask Luv about texting setup/);
  });
});
