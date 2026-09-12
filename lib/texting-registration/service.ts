/**
 * HTC texting registration service — venue-facing onboarding.
 * Does not call live Twilio provisioning APIs.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { isSmsConfigured } from "@/lib/sms/send";
import { getVenueTwilioAccountByVenueId } from "@/lib/sms/venue-twilio-config";
import { getCurrentUserRole, getCurrentVenue } from "@/lib/venue/service";
import type { Venue } from "@/lib/venue/types";
import {
  canConfigureVenueTexting,
  TEXTING_SETUP_ROLE_DENIED,
} from "@/lib/texting-registration/authority";
import {
  assertTextingPhaseTransition,
  canEditTextingRegistration,
  canSubmitTextingRegistration,
  phaseAfterProviderSubmit,
} from "@/lib/texting-registration/lifecycle";
import { getTextingProviderOrchestrator } from "@/lib/texting-registration/provider-contract";
import {
  getTextingRegistration,
  storeRegistrationNumberCiphertext,
  upsertTextingRegistration,
  type TextingRegistrationWrite,
} from "@/lib/texting-registration/repository";
import {
  encryptSensitiveField,
  normalizeRegistrationNumber,
  registrationNumberLast4,
} from "@/lib/texting-registration/sensitive-field";
import { buildTextingStatusPanel } from "@/lib/texting-registration/status-panel";
import { resolveTextingDisplayPhase } from "@/lib/texting-registration/account-sync";
import type {
  TextingPhase,
  TextingRegistrationInput,
  TextingRegistrationView,
  TextingStatusPanel,
} from "@/lib/texting-registration/types";
import {
  isBusinessIdentityComplete,
  toTextingInput,
  validateTextingRegistration,
} from "@/lib/texting-registration/validation";

const CUSTOMER_SAVE_ERROR =
  "We couldn’t save your texting details securely. Try again, or contact support if this continues.";

function isSensitiveStorageError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /SENSITIVE_FIELD_ENCRYPTION_KEY|sensitive field|ciphertext|encrypt/i.test(msg);
}

export type TextingSetupBundle = {
  registration: TextingRegistrationView | null;
  phase: TextingPhase;
  prefill: TextingRegistrationInput;
  statusPanel: TextingStatusPanel;
  smsReady: boolean;
  textingNumberE164: string | null;
  canEdit: boolean;
  /** Owner/manager may enable or change setup; coordinators see read-only. */
  canConfigure: boolean;
};

function emptyPrefillFromVenue(venue: Venue): TextingRegistrationInput {
  const website = venue.website?.trim() ?? "";
  return {
    businessName: (venue.businessName ?? venue.name ?? "").trim(),
    websiteUrl: website && !/^https?:\/\//i.test(website) ? `https://${website}` : website,
    addressLine1: venue.addressLine1 ?? "",
    addressLine2: venue.addressLine2 ?? "",
    city: venue.city ?? "",
    stateRegion: venue.stateRegion ?? "",
    postalCode: venue.postalCode ?? "",
    // Prefill only when venue already has a country — never invent "United States".
    country: venue.country?.trim() ?? "",
    contactEmail: venue.email ?? "",
    contactPhone: venue.phone ?? "",
    businessType: "",
    businessIndustry: "",
    // No silent EIN / regions defaults — venue must choose.
    registrationIdType: "",
    registrationNumber: "",
    regionsOfOperation: "",
    repFirstName: "",
    repLastName: "",
    repEmail: venue.email ?? "",
    repPhone: venue.phone ?? "",
    repBusinessTitle: "",
    repJobPosition: "",
    messagingPurpose: "",
    sampleMessage1: "",
    sampleMessage2: "",
    optInDescription: "",
    privacyPolicyUrl: "",
    termsUrl: "",
  };
}

function mergePrefill(
  venue: Venue,
  registration: TextingRegistrationView | null,
): TextingRegistrationInput {
  const fromVenue = emptyPrefillFromVenue(venue);
  if (!registration) return fromVenue;
  const fromReg = toTextingInput(registration);
  return {
    ...fromVenue,
    ...Object.fromEntries(
      Object.entries(fromReg).map(([k, v]) => [
        k,
        typeof v === "string" && v.trim()
          ? v
          : fromVenue[k as keyof TextingRegistrationInput],
      ]),
    ) as TextingRegistrationInput,
    registrationNumber: "",
    // Prefer saved registration values; never invent EIN / regions.
    registrationIdType: fromReg.registrationIdType || "",
    regionsOfOperation: fromReg.regionsOfOperation || "",
  };
}

function inputToWrite(
  input: TextingRegistrationInput,
  opts: {
    phase: TextingPhase;
    clearAttention?: boolean;
    businessConfirmed?: boolean;
    submittedAt?: string | null;
    last4?: string | null;
  },
): TextingRegistrationWrite {
  const write: TextingRegistrationWrite = {
    phase: opts.phase,
    business_name: input.businessName.trim() || null,
    website_url: input.websiteUrl.trim() || null,
    address_line1: input.addressLine1.trim() || null,
    address_line2: input.addressLine2.trim() || null,
    city: input.city.trim() || null,
    state_region: input.stateRegion.trim() || null,
    postal_code: input.postalCode.trim() || null,
    country: input.country.trim() || null,
    contact_email: input.contactEmail.trim() || null,
    contact_phone: input.contactPhone.trim() || null,
    business_type: input.businessType.trim() || null,
    business_industry: input.businessIndustry.trim() || null,
    registration_id_type: input.registrationIdType.trim() || null,
    regions_of_operation: input.regionsOfOperation.trim() || null,
    rep_first_name: input.repFirstName.trim() || null,
    rep_last_name: input.repLastName.trim() || null,
    rep_email: input.repEmail.trim() || null,
    rep_phone: input.repPhone.trim() || null,
    rep_business_title: input.repBusinessTitle.trim() || null,
    rep_job_position: input.repJobPosition.trim() || null,
    messaging_purpose: input.messagingPurpose.trim() || null,
    sample_message_1: input.sampleMessage1.trim() || null,
    sample_message_2: input.sampleMessage2.trim() || null,
    opt_in_description: input.optInDescription.trim() || null,
    privacy_policy_url: input.privacyPolicyUrl.trim() || null,
    terms_url: input.termsUrl.trim() || null,
  };

  if (opts.businessConfirmed || isBusinessIdentityComplete(input)) {
    write.business_confirmed_at = new Date().toISOString();
  }
  if (opts.clearAttention) {
    write.attention_code = null;
    write.attention_message = null;
    write.attention_fix_hint = null;
  }
  if (opts.submittedAt !== undefined) {
    write.submitted_at = opts.submittedAt;
  }
  if (opts.last4 !== undefined && opts.last4) {
    write.registration_number_last4 = opts.last4;
  }

  return write;
}

async function persistRegistrationNumberIfProvided(
  venueId: string,
  input: TextingRegistrationInput,
): Promise<string | null> {
  const digits = normalizeRegistrationNumber(input.registrationNumber);
  if (!digits) return null;
  const ciphertext = encryptSensitiveField(digits);
  const last4 = registrationNumberLast4(digits);
  await storeRegistrationNumberCiphertext({ venueId, ciphertext, last4 });
  return last4;
}

async function requireVenueContext() {
  if (!isSupabaseConfigured) {
    return { ok: false as const, message: "Backend not configured." };
  }
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false as const, message: "Session expired." };
  const client = await createClient();
  const role = await getCurrentUserRole();
  return { ok: true as const, venue, client, role };
}

async function requireTextingConfigureAuthority(): Promise<
  | { ok: true; venue: Venue; client: Awaited<ReturnType<typeof createClient>>; role: string | null }
  | { ok: false; message: string }
> {
  const ctx = await requireVenueContext();
  if (!ctx.ok) return ctx;
  if (!canConfigureVenueTexting(ctx.role)) {
    return { ok: false, message: TEXTING_SETUP_ROLE_DENIED };
  }
  return ctx;
}

export async function getTextingSetupBundle(): Promise<TextingSetupBundle | null> {
  const ctx = await requireVenueContext();
  if (!ctx.ok) return null;
  const { venue, client, role } = ctx;
  try {
    const registration = await getTextingRegistration(client, venue.id);
    const storedPhase: TextingPhase = registration?.phase ?? "not_started";
    const account = await getVenueTwilioAccountByVenueId(client, venue.id);
    const smsReady = await isSmsConfigured(venue.id);
    const textingNumberE164 = account?.defaultFromE164 ?? null;
    const phase = resolveTextingDisplayPhase(storedPhase, account, smsReady);
    const statusPanel = buildTextingStatusPanel({
      registration,
      phase,
      smsReady,
      textingNumberE164,
    });
    const canConfigure = canConfigureVenueTexting(role);
    return {
      registration,
      phase,
      prefill: mergePrefill(venue, registration),
      statusPanel,
      smsReady,
      textingNumberE164,
      canEdit: canConfigure && canEditTextingRegistration(storedPhase),
      canConfigure,
    };
  } catch (e) {
    console.error("getTextingSetupBundle failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

export async function startTextingSetup(): Promise<
  { ok: true; registration: TextingRegistrationView } | { ok: false; message: string }
> {
  const ctx = await requireTextingConfigureAuthority();
  if (!ctx.ok) return ctx;
  const { venue, client } = ctx;
  const existing = await getTextingRegistration(client, venue.id);
  if (existing) {
    if (existing.phase === "not_started") {
      assertTextingPhaseTransition("not_started", "details_needed");
      const updated = await upsertTextingRegistration(client, venue.id, {
        ...inputToWrite(mergePrefill(venue, existing), { phase: "details_needed" }),
        phase: "details_needed",
      });
      return { ok: true, registration: updated };
    }
    return { ok: true, registration: existing };
  }
  assertTextingPhaseTransition("not_started", "details_needed");
  const prefill = emptyPrefillFromVenue(venue);
  const created = await upsertTextingRegistration(client, venue.id, {
    ...inputToWrite(prefill, { phase: "details_needed" }),
    phase: "details_needed",
  });
  return { ok: true, registration: created };
}

export async function saveTextingRegistrationDraft(
  input: TextingRegistrationInput,
): Promise<
  | { ok: true; registration: TextingRegistrationView }
  | { ok: false; message: string; errors?: Record<string, string> }
> {
  const ctx = await requireTextingConfigureAuthority();
  if (!ctx.ok) return ctx;
  const { venue, client } = ctx;
  let existing = await getTextingRegistration(client, venue.id);
  if (!existing) {
    const started = await startTextingSetup();
    if (!started.ok) return started;
    existing = started.registration;
  }
  if (!canEditTextingRegistration(existing.phase)) {
    return { ok: false, message: "Texting registration can’t be edited in its current state." };
  }
  const phase: TextingPhase =
    existing.phase === "needs_attention" || existing.phase === "failed"
      ? "details_needed"
      : existing.phase === "not_started"
        ? "details_needed"
        : existing.phase === "information_saved"
          ? "details_needed"
          : existing.phase;
  if (phase !== existing.phase) {
    assertTextingPhaseTransition(existing.phase, phase);
  } else if (existing.phase === "details_needed") {
    assertTextingPhaseTransition("details_needed", "details_needed");
  }

  try {
    const last4 = await persistRegistrationNumberIfProvided(venue.id, input);
    const saved = await upsertTextingRegistration(client, venue.id, {
      ...inputToWrite(input, {
        phase,
        clearAttention: phase === "details_needed",
        businessConfirmed: isBusinessIdentityComplete(input),
        last4: last4 ?? undefined,
      }),
    });
    return { ok: true, registration: saved };
  } catch (e) {
    return {
      ok: false,
      message: isSensitiveStorageError(e) ? CUSTOMER_SAVE_ERROR : (
        e instanceof Error ? e.message : CUSTOMER_SAVE_ERROR
      ),
    };
  }
}

export async function submitTextingRegistration(
  input: TextingRegistrationInput,
): Promise<
  | { ok: true; registration: TextingRegistrationView; statusPanel: TextingStatusPanel }
  | { ok: false; message: string; errors?: Record<string, string> }
> {
  const ctx = await requireTextingConfigureAuthority();
  if (!ctx.ok) return ctx;
  const { venue, client } = ctx;
  let existing = await getTextingRegistration(client, venue.id);
  if (!existing) {
    const started = await startTextingSetup();
    if (!started.ok) return started;
    existing = started.registration;
  }
  const editableForSubmit =
    existing.phase === "details_needed"
    || existing.phase === "information_saved"
    || existing.phase === "needs_attention"
    || existing.phase === "failed"
    || existing.phase === "not_started";
  if (!editableForSubmit || !canSubmitTextingRegistration(
    existing.phase === "not_started" ? "details_needed" : existing.phase,
  )) {
    return { ok: false, message: "Texting registration can’t be submitted in its current state." };
  }

  const validation = validateTextingRegistration(input, {
    hasExistingRegistrationNumber: existing.hasRegistrationNumber,
  });
  if (!validation.ok) {
    return {
      ok: false,
      message: "Some required details are still missing.",
      errors: validation.errors as Record<string, string>,
    };
  }

  if (existing.phase === "not_started") {
    assertTextingPhaseTransition("not_started", "details_needed");
  }

  const provider = getTextingProviderOrchestrator();
  const providerResult = await provider.submitRegistration(venue.id);
  if (!providerResult.ok) {
    return { ok: false, message: providerResult.message };
  }

  const nextPhase = phaseAfterProviderSubmit(providerResult);
  const transitionFrom: TextingPhase =
    existing.phase === "not_started" ? "details_needed" : existing.phase;
  assertTextingPhaseTransition(transitionFrom, nextPhase);

  const now = new Date().toISOString();
  let saved: TextingRegistrationView;
  try {
    const last4 = await persistRegistrationNumberIfProvided(venue.id, input);
    saved = await upsertTextingRegistration(client, venue.id, {
      ...inputToWrite(input, {
        phase: nextPhase,
        clearAttention: true,
        businessConfirmed: true,
        submittedAt: now,
        last4: last4 ?? undefined,
      }),
    });
  } catch (e) {
    return {
      ok: false,
      message: isSensitiveStorageError(e) ? CUSTOMER_SAVE_ERROR : (
        e instanceof Error ? e.message : "Could not save texting registration."
      ),
    };
  }

  const account = await getVenueTwilioAccountByVenueId(client, venue.id);
  const smsReady = await isSmsConfigured(venue.id);
  const displayPhase = resolveTextingDisplayPhase(saved.phase, account, smsReady);
  const statusPanel = buildTextingStatusPanel({
    registration: saved,
    phase: displayPhase,
    smsReady,
    textingNumberE164: account?.defaultFromE164 ?? null,
  });
  return { ok: true, registration: saved, statusPanel };
}

/**
 * Ops / Track B sync: apply provider-suggested phase with transition guards.
 * Uses service_role — authenticated clients cannot write these phases.
 */
export async function applyTextingProviderAttention(input: {
  venueId: string;
  fromPhase: TextingPhase;
  toPhase: TextingPhase;
  attentionCode: string;
  attentionMessage: string;
  attentionFixHint: string;
  supportDebug?: Record<string, unknown>;
}): Promise<void> {
  assertTextingPhaseTransition(input.fromPhase, input.toPhase);
  const admin = createAdminClient();
  const patch: Record<string, unknown> = {
    phase: input.toPhase,
    attention_code: input.attentionCode,
    attention_message: input.attentionMessage,
    attention_fix_hint: input.attentionFixHint,
    last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (input.supportDebug) {
    patch.support_debug = input.supportDebug;
  }
  const { error } = await admin
    .from("venue_texting_registrations")
    .update(patch)
    .eq("venue_id", input.venueId);
  if (error) throw new Error(error.message);
}
