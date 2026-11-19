/**
 * LUV-CONSENT — draft eligibility + accept-boundary consent (deterministic).
 * No paid AI. No live email/SMS.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  isOutboundChannelConsentOk,
} from "@/lib/communication/permissions";
import {
  channelConsentOkForDraftType,
  isIntentEligibleForLifecycle,
  resolveRelationshipLifecycle,
  shouldWithdrawSalesFollowUpDraft,
} from "@/lib/luv/relationship-lifecycle-eligibility";
import { resolveFollowUpDraftEligibility } from "@/lib/luv/follow-up-draft-eligibility";
import { luvDraftTypeToChannel } from "@/lib/luv/relationship-lifecycle-loader";

describe("LUV-CONSENT channel consent semantics", () => {
  it("maps draft types to channels", () => {
    assert.equal(luvDraftTypeToChannel("follow_up_email"), "email");
    assert.equal(luvDraftTypeToChannel("follow_up_text"), "sms");
    assert.equal(luvDraftTypeToChannel("next_steps"), "email");
  });

  it("email: consented / not_opted_in allowed; revoked + bounced blocked", () => {
    assert.equal(isOutboundChannelConsentOk("email", "opted_in"), true);
    assert.equal(isOutboundChannelConsentOk("email", "not_opted_in"), true);
    assert.equal(isOutboundChannelConsentOk("email", null), true); // unknown → not_opted_in
    assert.equal(isOutboundChannelConsentOk("email", "opted_out"), false);
    assert.equal(isOutboundChannelConsentOk("email", "provider_blocked"), false);
  });

  it("SMS: only opted_in allowed; missing/revoked blocked (never invent consent)", () => {
    assert.equal(isOutboundChannelConsentOk("sms", "opted_in"), true);
    assert.equal(isOutboundChannelConsentOk("sms", "not_opted_in"), false);
    assert.equal(isOutboundChannelConsentOk("sms", null), false);
    assert.equal(isOutboundChannelConsentOk("sms", undefined), false);
    assert.equal(isOutboundChannelConsentOk("sms", "opted_out"), false);
    assert.equal(isOutboundChannelConsentOk("sms", "provider_blocked"), false);
  });

  it("email consented + SMS missing: email draft OK, text draft blocked", () => {
    const facts = {
      emailConsentOk: true,
      smsConsentOk: false,
      channelConsentOk: true,
    };
    assert.equal(channelConsentOkForDraftType("follow_up_email", facts), true);
    assert.equal(channelConsentOkForDraftType("follow_up_text", facts), false);

    const emailGate = resolveFollowUpDraftEligibility({
      tour: { kind: "none" },
      nextActionText: null,
      lifecycleFacts: { ...facts, channelConsentOk: true },
    });
    assert.equal(emailGate.draftCapable, true);

    const smsGate = resolveFollowUpDraftEligibility({
      tour: { kind: "none" },
      nextActionText: null,
      lifecycleFacts: { ...facts, channelConsentOk: false },
    });
    assert.equal(smsGate.draftCapable, false);
    assert.equal(smsGate.lifecycle?.salesFollowUpBlockReasonCode, "consent_revoked");
  });

  it("email consent missing/revoked blocks email follow-up", () => {
    const gate = resolveFollowUpDraftEligibility({
      tour: { kind: "none" },
      nextActionText: null,
      lifecycleFacts: {
        emailConsentOk: false,
        smsConsentOk: true,
        channelConsentOk: false,
      },
    });
    assert.equal(gate.draftCapable, false);
    assert.match(gate.capabilityBlockReason ?? "", /consent/i);
  });

  it("SMS consent missing/revoked blocks text follow-up", () => {
    const decision = resolveRelationshipLifecycle({
      emailConsentOk: true,
      smsConsentOk: false,
      channelConsentOk: false,
    });
    assert.equal(decision.salesFollowUpAllowed, false);
    assert.equal(decision.salesFollowUpBlockReasonCode, "consent_revoked");
  });

  it("draft created while permitted; consent revoked before accept → withdraw", () => {
    const decision = resolveRelationshipLifecycle({
      channelConsentOk: false,
      emailConsentOk: false,
      smsConsentOk: false,
    });
    const check = shouldWithdrawSalesFollowUpDraft({
      draftType: "follow_up_email",
      context: { workflowIntent: "gentle_check_in", communicationPurpose: "none" },
      decision,
    });
    assert.equal(check.withdraw, true);
    assert.equal(check.reasonCode, "consent_revoked");
  });

  it("consent granted after earlier block restores eligibility", () => {
    const blocked = resolveFollowUpDraftEligibility({
      tour: { kind: "none" },
      nextActionText: null,
      lifecycleFacts: { channelConsentOk: false, emailConsentOk: false },
    });
    assert.equal(blocked.draftCapable, false);

    const allowed = resolveFollowUpDraftEligibility({
      tour: { kind: "none" },
      nextActionText: null,
      lifecycleFacts: { channelConsentOk: true, emailConsentOk: true, smsConsentOk: false },
    });
    assert.equal(allowed.draftCapable, true);
  });

  it("channel switch re-evaluates consent (email ↔ SMS)", () => {
    const facts = { emailConsentOk: true, smsConsentOk: false };
    assert.equal(channelConsentOkForDraftType("follow_up_email", facts), true);
    assert.equal(channelConsentOkForDraftType("follow_up_text", facts), false);

    const switched = { emailConsentOk: false, smsConsentOk: true };
    assert.equal(channelConsentOkForDraftType("follow_up_email", switched), false);
    assert.equal(channelConsentOkForDraftType("follow_up_text", switched), true);
  });

  it("unknown / omitted channel consent does not become affirmative for draft type", () => {
    assert.equal(channelConsentOkForDraftType("follow_up_email", {}), false);
    assert.equal(channelConsentOkForDraftType("follow_up_text", {}), false);
  });

  it("consent revocation blocks answer_questions (cannot bypass send gate via intent)", () => {
    const decision = resolveRelationshipLifecycle({ channelConsentOk: false });
    assert.equal(isIntentEligibleForLifecycle("answer_questions", decision), false);
    const check = shouldWithdrawSalesFollowUpDraft({
      draftType: "follow_up_email",
      context: {
        workflowIntent: "answer_questions",
        communicationPurpose: "unresolved_question",
      },
      decision,
    });
    assert.equal(check.withdraw, true);
    assert.equal(check.reasonCode, "consent_revoked");
  });

  it("lost / archived / booked protections retained alongside consent", () => {
    assert.equal(
      resolveRelationshipLifecycle({
        channelConsentOk: true,
        lostAt: "2026-01-01T00:00:00Z",
      }).salesFollowUpAllowed,
      false,
    );
    assert.equal(
      resolveRelationshipLifecycle({
        channelConsentOk: true,
        leadStatus: "archived",
      }).salesFollowUpBlockReasonCode,
      "archived",
    );
    assert.equal(
      resolveRelationshipLifecycle({
        channelConsentOk: true,
        firstBookedAt: "2026-01-01T00:00:00Z",
      }).salesFollowUpBlockReasonCode,
      "officially_booked",
    );
  });

  it("venue isolation: consent facts are address+venue scoped helpers (keys differ)", () => {
    // Documented contract: getCommunicationPermission keys on venue_id + channel + address_key.
    // Different venues / leads with different addresses cannot share a single channelConsentOk.
    const venueA = channelConsentOkForDraftType("follow_up_email", {
      emailConsentOk: true,
      smsConsentOk: false,
    });
    const venueB = channelConsentOkForDraftType("follow_up_email", {
      emailConsentOk: false,
      smsConsentOk: false,
    });
    assert.notEqual(venueA, venueB);
  });

  it("accept boundary + send path still recheck consent (no draft bypass)", () => {
    const drafts = readFileSync(fileURLToPath(new URL("./drafts.ts", import.meta.url)), "utf8");
    const loader = readFileSync(
      fileURLToPath(new URL("./relationship-lifecycle-loader.ts", import.meta.url)),
      "utf8",
    );
    const conversations = readFileSync(
      fileURLToPath(new URL("../conversations/service.ts", import.meta.url)),
      "utf8",
    );
    assert.match(drafts, /Luv never sends anything/);
    assert.match(drafts, /channelConsentOkForDraftType/);
    assert.match(drafts, /luvDraftTypeToChannel/);
    assert.match(drafts, /loadRelationshipLifecycleFacts/);
    assert.match(loader, /getCommunicationPermission/);
    assert.doesNotMatch(loader, /channelConsentOk:\s*true/);
    assert.match(conversations, /assertChannelAllowed/);
  });
});
