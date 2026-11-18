/**
 * Persist Event Streams phone A2P events onto venue_twilio_accounts.
 * Idempotent; never logs raw payloads or secrets.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import {
  getVenueTwilioAccountByAccountSid,
} from "@/lib/sms/venue-twilio-config";
import {
  getVenueTwilioAccountExtended,
  upsertVenueTwilioAccount,
} from "@/lib/texting-provisioning/account-repository";
import {
  decidePhoneA2pEventApply,
  type PhoneA2pEventPayload,
} from "@/lib/texting-provisioning/phone-a2p-status";
import { resumeVenueTextingProvisioningAfterPhoneRegistered } from "@/lib/texting-provisioning/resume-after-phone-registered";
import { assertTextingPhaseTransition } from "@/lib/texting-registration/lifecycle";
import type { TextingPhase } from "@/lib/texting-registration/types";

export type ApplyPhoneA2pEventResult =
  | {
      ok: true;
      applied: boolean;
      ignored?: boolean;
      reason?: string;
      resumed?: boolean;
      ready?: boolean;
    }
  | { ok: false; status: 401 | 404 | 409; reason: string };

async function eventAlreadyStored(eventId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("venue_twilio_a2p_events")
    .select("event_id")
    .eq("event_id", eventId)
    .maybeSingle();
  return !!data;
}

async function storeEventRow(input: {
  venueId: string;
  payload: PhoneA2pEventPayload;
  applied: boolean;
  ignoredReason: string | null;
}): Promise<"inserted" | "duplicate"> {
  const admin = createAdminClient();
  const { error } = await admin.from("venue_twilio_a2p_events").insert({
    venue_id: input.venueId,
    twilio_account_sid: input.payload.accountSid,
    event_id: input.payload.eventId,
    event_type: input.payload.eventType,
    event_time: input.payload.eventTimeMs
      ? new Date(input.payload.eventTimeMs).toISOString()
      : null,
    phone_number_sid: input.payload.phoneNumberSid,
    messaging_service_sid: input.payload.messagingServiceSid,
    campaign_sid: input.payload.campaignSid,
    external_status: input.payload.externalStatus,
    applied: input.applied,
    ignored_reason: input.ignoredReason,
  });
  if (error) {
    if (/duplicate|unique|23505/i.test(error.message ?? "")) return "duplicate";
    throw new Error(error.message);
  }
  return "inserted";
}

async function setRegistrationPhase(input: {
  venueId: string;
  toPhase: TextingPhase;
  attentionCode?: string | null;
  attentionMessage?: string | null;
  attentionFixHint?: string | null;
}): Promise<void> {
  const admin = createAdminClient();
  const { data: current } = await admin
    .from("venue_texting_registrations")
    .select("phase")
    .eq("venue_id", input.venueId)
    .maybeSingle();
  const from = (current?.phase as TextingPhase | undefined) ?? "setting_up_number";
  if (from !== input.toPhase) {
    try {
      assertTextingPhaseTransition(from, input.toPhase);
    } catch {
      // Provider sync may jump phases after deregistration / failure.
    }
  }
  const patch: Record<string, unknown> = {
    phase: input.toPhase,
    last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    attention_code: input.attentionCode ?? null,
    attention_message: input.attentionMessage ?? null,
    attention_fix_hint: input.attentionFixHint ?? null,
  };
  if (input.toPhase === "ready") {
    patch.approved_at = new Date().toISOString();
  }
  const { error } = await admin
    .from("venue_texting_registrations")
    .update(patch)
    .eq("venue_id", input.venueId);
  if (error) throw new Error(error.message);
}

export async function applyPhoneA2pEvent(
  payload: PhoneA2pEventPayload,
): Promise<ApplyPhoneA2pEventResult> {
  const admin = createAdminClient();
  const account = await getVenueTwilioAccountByAccountSid(admin, payload.accountSid);
  if (!account) {
    return { ok: false, status: 404, reason: "unknown_account" };
  }

  const extended = await getVenueTwilioAccountExtended(account.venueId);
  const already = await eventAlreadyStored(payload.eventId);
  const lastEventTimeMs = extended?.phoneA2pLastEventAt
    ? Date.parse(extended.phoneA2pLastEventAt)
    : null;

  const decision = decidePhoneA2pEventApply({
    payload,
    venueAccountSid: account.twilioAccountSid,
    expectedPhoneNumberSid: account.phoneNumberSid,
    expectedMessagingServiceSid: account.messagingServiceSid || null,
    lastEventTimeMs: Number.isFinite(lastEventTimeMs) ? lastEventTimeMs : null,
    alreadyProcessedEventId: already,
  });

  if (decision.action === "reject") {
    console.error("[a2p-events] rejected", {
      venueId: account.venueId,
      reason: decision.reason,
      eventType: payload.eventType,
      timestamp: new Date().toISOString(),
    });
    return {
      ok: false,
      status: decision.reason === "unknown_event_type" ? 409 : 409,
      reason: decision.reason,
    };
  }

  if (decision.action === "ignore") {
    if (!already) {
      await storeEventRow({
        venueId: account.venueId,
        payload,
        applied: false,
        ignoredReason: decision.reason,
      });
    }
    return { ok: true, applied: false, ignored: true, reason: decision.reason };
  }

  const insertResult = await storeEventRow({
    venueId: account.venueId,
    payload,
    applied: true,
    ignoredReason: null,
  });
  if (insertResult === "duplicate") {
    return { ok: true, applied: false, ignored: true, reason: "duplicate_event_id" };
  }

  const eventAt = payload.eventTimeMs
    ? new Date(payload.eventTimeMs).toISOString()
    : new Date().toISOString();

  const patch: Parameters<typeof upsertVenueTwilioAccount>[0] = {
    venueId: account.venueId,
    phoneA2pStatus: decision.phoneA2pStatus,
    phoneA2pStatusUpdatedAt: new Date().toISOString(),
    phoneA2pLastEventAt: eventAt,
  };

  if (decision.clearSendReady) {
    if (decision.phoneA2pStatus === "PENDING_REGISTRATION") {
      patch.status = "pending_compliance";
      patch.statusDetail = "Waiting for texting number registration";
    } else if (decision.phoneA2pStatus === "FAILURE") {
      patch.status = "error";
      patch.statusDetail = "Phone number registration failed";
    } else {
      patch.status = "suspended";
      patch.statusDetail = "Texting number registration changed";
    }
  }

  await upsertVenueTwilioAccount(patch);

  if (decision.needsAttention) {
    await setRegistrationPhase({
      venueId: account.venueId,
      toPhase: "needs_attention",
      attentionCode: decision.attentionCode,
      attentionMessage: decision.attentionMessage,
      attentionFixHint: decision.attentionFixHint,
    });
  } else if (
    decision.phoneA2pStatus === "UNREGISTERED"
    || decision.phoneA2pStatus === "PENDING_DEREGISTRATION"
  ) {
    // Lifecycle allows ready → paused. Pre-ready venues stay in setting_up_number.
    const toPhase: TextingPhase = account.status === "ready" ? "paused" : "setting_up_number";
    await setRegistrationPhase({
      venueId: account.venueId,
      toPhase,
      attentionCode: decision.attentionCode,
      attentionMessage: decision.attentionMessage,
      attentionFixHint: decision.attentionFixHint,
    });
  } else if (decision.phoneA2pStatus === "PENDING_REGISTRATION") {
    if (account.status !== "ready") {
      await setRegistrationPhase({
        venueId: account.venueId,
        toPhase: "setting_up_number",
      });
    }
  }
  let resumed = false;
  let ready = false;
  if (decision.phoneA2pStatus === "REGISTERED") {
    // Automatic continuation — do not wait for another venue submit.
    try {
      const resume = await resumeVenueTextingProvisioningAfterPhoneRegistered(account.venueId);
      resumed = resume.stepsAdvanced > 0 || resume.ready;
      ready = resume.ready;
      if (resume.error && resume.error !== "protected_venue") {
        console.error("[a2p-events] resume after REGISTERED", {
          venueId: account.venueId,
          error: resume.error,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      // Status is already persisted; scheduler recovery will retry.
      console.error("[a2p-events] resume threw after REGISTERED", {
        venueId: account.venueId,
        message: err instanceof Error ? err.message : "resume_failed",
        timestamp: new Date().toISOString(),
      });
    }
  }

  console.log("[a2p-events] applied", {
    venueId: account.venueId,
    eventType: payload.eventType,
    phoneA2pStatus: decision.phoneA2pStatus,
    resumed,
    ready,
    timestamp: new Date().toISOString(),
  });

  return { ok: true, applied: true, resumed, ready };
}
