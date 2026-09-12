import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import path from "node:path";

import {
  assertTextingPhaseTransition,
  canEditTextingRegistration,
  canResubmitTextingRegistration,
  canSubmitTextingRegistration,
  canTransitionTextingPhase,
  isProviderAuthoritativeTextingPhase,
  isVenueWritableTextingPhase,
  phaseAfterProviderSubmit,
} from "@/lib/texting-registration/lifecycle";
import {
  OpsFirstTextingProviderOrchestrator,
} from "@/lib/texting-registration/provider-contract";
import {
  decryptSensitiveField,
  encryptSensitiveField,
  maskRegistrationNumberLast4,
  registrationNumberLast4,
} from "@/lib/texting-registration/sensitive-field";
import {
  assertNoProviderLeak,
  buildTextingStatusPanel,
  impliesProviderRegistrationPending,
} from "@/lib/texting-registration/status-panel";
import {
  INFORMATION_SAVED_STATUS_COPY,
  PROVIDER_AUTHORITATIVE_TEXTING_PHASES,
  TEXTING_SETUP_PATH,
  VENUE_WRITABLE_TEXTING_PHASES,
} from "@/lib/texting-registration/types";
import type { TextingRegistrationView } from "@/lib/texting-registration/types";
import {
  isBusinessIdentityComplete,
  toTextingInput,
  validateTextingRegistration,
} from "@/lib/texting-registration/validation";
import { isVenueTwilioSendReady } from "@/lib/sms/venue-twilio-config";

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
    businessConfirmedAt: null,
    businessType: null,
    businessIndustry: null,
    registrationIdType: null,
    hasRegistrationNumber: false,
    registrationNumberLast4: null,
    regionsOfOperation: null,
    repFirstName: null,
    repLastName: null,
    repEmail: null,
    repPhone: null,
    repBusinessTitle: null,
    repJobPosition: null,
    messagingPurpose: null,
    sampleMessage1: null,
    sampleMessage2: null,
    optInDescription: null,
    privacyPolicyUrl: null,
    termsUrl: null,
    submittedAt: null,
    approvedAt: null,
    lastSyncedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("texting registration lifecycle", () => {
  it("allows the documented happy path and rejects invalid jumps", () => {
    assert.equal(canTransitionTextingPhase("not_started", "details_needed"), true);
    assert.equal(canTransitionTextingPhase("details_needed", "information_saved"), true);
    assert.equal(canTransitionTextingPhase("details_needed", "under_review"), true);
    assert.equal(canTransitionTextingPhase("information_saved", "under_review"), true);
    assert.equal(canTransitionTextingPhase("under_review", "setting_up_number"), true);
    assert.equal(canTransitionTextingPhase("setting_up_number", "ready"), true);
    assert.equal(canTransitionTextingPhase("not_started", "ready"), false);
    assert.equal(canTransitionTextingPhase("ready", "under_review"), false);
    assert.equal(canTransitionTextingPhase("information_saved", "ready"), false);
    assert.throws(() => assertTextingPhaseTransition("ready", "details_needed"));
    assert.throws(() => assertTextingPhaseTransition("details_needed", "ready"));
    assert.throws(() => assertTextingPhaseTransition("details_needed", "paused"));
  });

  it("gates edit/submit/resubmit by phase including information_saved", () => {
    assert.equal(canEditTextingRegistration("details_needed"), true);
    assert.equal(canEditTextingRegistration("information_saved"), true);
    assert.equal(canEditTextingRegistration("under_review"), false);
    assert.equal(canSubmitTextingRegistration("information_saved"), true);
    assert.equal(canResubmitTextingRegistration("information_saved"), true);
    assert.equal(canResubmitTextingRegistration("ready"), false);
  });

  it("maps deferred provider submit to information_saved, not under_review", () => {
    assert.equal(
      phaseAfterProviderSubmit({
        ok: true,
        accepted: false,
        deferred: true,
        reason: "Your information is saved. Hello to Cheers is setting up texting for your venue.",
      }),
      "information_saved",
    );
    assert.equal(
      phaseAfterProviderSubmit({ ok: true, accepted: true }),
      "under_review",
    );
    assert.equal(
      phaseAfterProviderSubmit({ ok: false, message: "boom" }),
      "information_saved",
    );
  });

  it("classifies venue-writable vs provider-authoritative phases", () => {
    for (const p of VENUE_WRITABLE_TEXTING_PHASES) {
      assert.equal(isVenueWritableTextingPhase(p), true);
      assert.equal(isProviderAuthoritativeTextingPhase(p), false);
    }
    for (const p of PROVIDER_AUTHORITATIVE_TEXTING_PHASES) {
      assert.equal(isProviderAuthoritativeTextingPhase(p), true);
      assert.equal(isVenueWritableTextingPhase(p), false);
    }
  });
});

describe("ops-first provider orchestrator honesty", () => {
  it("OpsFirstTextingProviderOrchestrator does not claim acceptance or leak dead-end copy", async () => {
    const orch = new OpsFirstTextingProviderOrchestrator();
    const result = await orch.submitRegistration("venue");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.accepted, false);
      assert.equal("deferred" in result && result.deferred, true);
      if ("deferred" in result) {
        assert.doesNotMatch(result.reason, /Provider provisioning is not enabled/i);
        assertNoProviderLeak(result.reason);
      }
    }
    const phase = phaseAfterProviderSubmit(result);
    assert.equal(phase, "information_saved");

    const panel = buildTextingStatusPanel({
      registration: sampleView({
        phase: "information_saved",
        businessConfirmedAt: new Date().toISOString(),
        submittedAt: new Date().toISOString(),
      }),
      phase: "information_saved",
      smsReady: false,
      textingNumberE164: null,
    });
    assert.equal(panel.messagingRegistration.label, "Saved");
    assert.notEqual(panel.messagingRegistration.label, "Pending");
    assert.equal(panel.texting.label, "Not ready");
    assert.equal(panel.smsReady, false);
    assert.ok(panel.attention);
    assert.equal(panel.attention!.message, INFORMATION_SAVED_STATUS_COPY);
    assert.equal(impliesProviderRegistrationPending(panel.attention!.message!), false);
    assert.equal(impliesProviderRegistrationPending(INFORMATION_SAVED_STATUS_COPY), false);
    assertNoProviderLeak(JSON.stringify(panel));
  });

  it("under_review remains available for ops-in-progress display", () => {
    const panel = buildTextingStatusPanel({
      registration: sampleView({
        phase: "under_review",
        businessConfirmedAt: new Date().toISOString(),
      }),
      phase: "under_review",
      smsReady: false,
      textingNumberE164: null,
    });
    assert.equal(panel.messagingRegistration.label, "Pending");
    assert.equal(panel.texting.label, "Pending");
    assert.equal(panel.smsReady, false);
    assert.ok(panel.attention);
    assert.match(panel.attention!.message!, /in progress/i);
  });

  it("ready + number when smsReady", () => {
    const panel = buildTextingStatusPanel({
      registration: sampleView({
        phase: "ready",
        businessConfirmedAt: new Date().toISOString(),
      }),
      phase: "ready",
      smsReady: true,
      textingNumberE164: "+15551112222",
    });
    assert.equal(panel.smsReady, true);
    assert.equal(panel.texting.label, "Ready");
    assert.equal(panel.textingNumber.e164, "+15551112222");
  });
});

describe("texting registration validation (no invented compliance)", () => {
  it("does not invent EIN or regions when validating incomplete compliance", () => {
    const input = toTextingInput(sampleView());
    assert.equal(input.registrationIdType, "");
    assert.equal(input.regionsOfOperation, "");
    assert.equal(isBusinessIdentityComplete(input), true);
    const v = validateTextingRegistration(input);
    assert.equal(v.ok, false);
    assert.ok(v.missing.includes("registrationIdType"));
    assert.ok(v.missing.includes("regionsOfOperation"));
  });

  it("accepts a complete registration including existing encrypted EIN", () => {
    const input = toTextingInput(sampleView({ hasRegistrationNumber: true }), {
      businessType: "llc",
      businessIndustry: "HOSPITALITY",
      registrationIdType: "EIN",
      regionsOfOperation: "USA_AND_CANADA",
      registrationNumber: "",
      repFirstName: "Jen",
      repLastName: "Owner",
      repEmail: "jen@example.com",
      repPhone: "+15551234567",
      repBusinessTitle: "Owner",
      repJobPosition: "ceo",
      messagingPurpose: "Booking questions and tour reminders",
      sampleMessage1: "Hi — confirming your tour Saturday at 2pm.",
      optInDescription: "Couples check a separate text-permission box on our inquiry form.",
      privacyPolicyUrl: "https://example.com/privacy",
      termsUrl: "https://example.com/terms",
    });
    const v = validateTextingRegistration(input, { hasExistingRegistrationNumber: true });
    assert.equal(v.ok, true);
  });
});

describe("sensitive registration number handling", () => {
  it("encrypts and decrypts without exposing plaintext helpers to UI mask", () => {
    const cipher = encryptSensitiveField("123456789");
    assert.notEqual(cipher, "123456789");
    assert.match(cipher, /^v1:/);
    assert.equal(decryptSensitiveField(cipher), "123456789");
    assert.equal(registrationNumberLast4("12-3456789"), "6789");
    assert.equal(maskRegistrationNumberLast4("6789"), "••••6789");
  });
});

describe("status panel + smsReady coupling", () => {
  it("keeps texting Not ready until provider binding is sendable", () => {
    const panel = buildTextingStatusPanel({
      registration: sampleView({
        phase: "information_saved",
        businessConfirmedAt: new Date().toISOString(),
      }),
      phase: "information_saved",
      smsReady: false,
      textingNumberE164: null,
    });
    assert.equal(panel.businessInformation.label, "Confirmed");
    assert.equal(panel.messagingRegistration.label, "Saved");
    assert.equal(panel.textingNumber.label, "Not yet assigned");
    assert.equal(panel.texting.label, "Not ready");
    assert.equal(panel.smsReady, false);
  });

  it("shows ready texting only when smsReady is true", () => {
    const panel = buildTextingStatusPanel({
      registration: sampleView({ phase: "ready", businessConfirmedAt: new Date().toISOString() }),
      phase: "ready",
      smsReady: true,
      textingNumberE164: "+15559876543",
    });
    assert.equal(panel.texting.label, "Ready");
    assert.match(panel.textingNumber.label, /987/);
  });

  it("renders needs attention and paused without provider jargon", () => {
    const attention = buildTextingStatusPanel({
      registration: sampleView({
        phase: "needs_attention",
        attentionMessage: "Messaging registration needs attention. Additional business information is required.",
        attentionFixHint: "Update your registration number and resubmit.",
      }),
      phase: "needs_attention",
      smsReady: false,
      textingNumberE164: null,
    });
    assert.ok(attention.attention);
    assert.equal(attention.canResubmit, true);
    assertNoProviderLeak(attention.attention!.message!);
    assertNoProviderLeak(JSON.stringify(attention));

    const paused = buildTextingStatusPanel({
      registration: sampleView({ phase: "paused" }),
      phase: "paused",
      smsReady: false,
      textingNumberE164: "+15551112222",
    });
    assert.equal(paused.texting.label, "Paused");
    assert.equal(paused.messagingRegistration.label, "Paused");
  });

  it("never treats pending_compliance or incomplete sender as HTC smsReady", () => {
    assert.equal(
      isVenueTwilioSendReady({
        venueId: "x",
        twilioAccountSid: "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        messagingServiceSid: "MGaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        defaultFromE164: "+15551112222",
        phoneNumberSid: "PNaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        secondaryProfileSid: null,
        a2pBrandSid: null,
        a2pCampaignSid: null,
        status: "pending_compliance",
        statusDetail: null,
      }),
      false,
    );
    assert.equal(
      isVenueTwilioSendReady({
        venueId: "x",
        twilioAccountSid: "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        messagingServiceSid: "MGaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        defaultFromE164: "+15551112222",
        phoneNumberSid: null,
        secondaryProfileSid: null,
        a2pBrandSid: null,
        a2pCampaignSid: null,
        status: "ready",
        statusDetail: null,
      }),
      false,
    );
  });
});

describe("deep links, leak guards, and migration authority", () => {
  it("uses the Settings texting anchor for setup", () => {
    assert.equal(TEXTING_SETUP_PATH, "/settings/communications#texting");
  });

  it("rejects provider identifiers in venue-facing copy", () => {
    assert.throws(() => assertNoProviderLeak("Open your Twilio console"));
    assert.throws(() => assertNoProviderLeak("Messaging Service MG123"));
    assert.doesNotThrow(() => assertNoProviderLeak("Enable text messaging for your venue"));
  });

  it("migration hardens provider phases and ciphertext against authenticated", () => {
    const migration = readFileSync(
      path.join(
        process.cwd(),
        "supabase/migrations/20261350000000_texting_registration_product_gate.sql",
      ),
      "utf8",
    );
    assert.match(migration, /information_saved/);
    assert.match(migration, /enforce_venue_texting_registration_phase_authority/);
    assert.match(migration, /revoke select \(registration_number_ciphertext\)/);
    for (const phase of PROVIDER_AUTHORITATIVE_TEXTING_PHASES) {
      assert.match(migration, new RegExp(`'${phase}'`));
    }
    assert.match(migration, /drop default/i);
  });

  it("repository view columns never select ciphertext", () => {
    const repo = readFileSync(
      path.join(process.cwd(), "lib/texting-registration/repository.ts"),
      "utf8",
    );
    assert.doesNotMatch(
      repo.split("VIEW_COLUMNS")[1]!.split("].join")[0]!,
      /registration_number_ciphertext/,
    );
  });
});
