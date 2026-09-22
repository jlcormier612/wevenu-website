/**
 * Idempotent venue texting provisioning runner.
 * Proven sequence: Brand APPROVED → Campaign → Campaign VERIFIED → phone → Ready.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { decryptSensitiveField } from "@/lib/texting-registration/sensitive-field";
import {
  getVenueTwilioAccountExtended,
  upsertVenueTwilioAccount,
} from "@/lib/texting-provisioning/account-repository";
import {
  claimDueProvisioningVenueIds,
  ensureProvisioningSteps,
  getProvisioningStep,
  listProvisioningSteps,
  markStepFailed,
  markStepRunning,
  markStepSucceeded,
} from "@/lib/texting-provisioning/step-repository";
import { TEXTING_PROVISIONING_STEPS, type TextingProvisioningStep } from "@/lib/texting-provisioning/steps";
import {
  isTerminalProvisioningErrorCode,
  provisioningRetryAt,
} from "@/lib/texting-provisioning/compliance-retry-policy";
import {
  assertVenueAllowedForSelfServiceProvisioning,
  isProtectedTextingVenueId,
} from "@/lib/sms/twilio-protected-resources";
import { loadVenueTwilioSecret } from "@/lib/sms/venue-twilio-secrets";
import type { TwilioCredentials } from "@/lib/sms/twilio-http";
import {
  attachPhoneToMessagingService,
  buyVenuePhoneNumber,
  configureMessagingServiceWebhooks,
  createVenueApiKey,
  createVenueMessagingService,
  createVenueSubaccount,
  fetchBrandStatus,
  fetchCampaignStatus,
  storeVenueTwilioSecret,
  submitA2pTrustProduct,
  submitBrandRegistration,
  submitCampaign,
  submitSecondaryCustomerProfile,
  type VenueBusinessForCompliance,
} from "@/lib/texting-provisioning/twilio-ops";
import { assertTextingPhaseTransition } from "@/lib/texting-registration/lifecycle";
import type { TextingPhase } from "@/lib/texting-registration/types";

type TransientCreds = {
  authToken?: string;
  apiKeySid?: string;
  apiKeySecret?: string;
};

const transientByVenue = new Map<string, TransientCreds>();

function appBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

async function loadRegistrationPhase(venueId: string): Promise<TextingPhase | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("venue_texting_registrations")
    .select("phase")
    .eq("venue_id", venueId)
    .maybeSingle();
  return (data?.phase as TextingPhase | undefined) ?? null;
}

async function loadBusiness(venueId: string): Promise<VenueBusinessForCompliance | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("venue_texting_registrations")
    .select("*")
    .eq("venue_id", venueId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  let registrationNumber = "";
  if (data.registration_number_ciphertext) {
    try {
      registrationNumber = decryptSensitiveField(String(data.registration_number_ciphertext));
    } catch {
      registrationNumber = "";
    }
  }

  return {
    legalBusinessName: String(data.business_name ?? "").trim(),
    websiteUrl: String(data.website_url ?? "").trim(),
    addressLine1: String(data.address_line1 ?? "").trim(),
    addressLine2: data.address_line2 ? String(data.address_line2) : null,
    city: String(data.city ?? "").trim(),
    stateRegion: String(data.state_region ?? "").trim(),
    postalCode: String(data.postal_code ?? "").trim(),
    country: String(data.country ?? "US").trim() || "US",
    contactEmail: String(data.contact_email ?? "").trim(),
    contactPhone: String(data.contact_phone ?? "").trim(),
    businessType: String(data.business_type ?? "").trim(),
    businessIndustry: String(data.business_industry ?? "").trim(),
    registrationIdType: String(data.registration_id_type ?? "EIN").trim() || "EIN",
    registrationNumber,
    regionsOfOperation: String(data.regions_of_operation ?? "USA_AND_CANADA").trim() || "USA_AND_CANADA",
    repFirstName: String(data.rep_first_name ?? "").trim(),
    repLastName: String(data.rep_last_name ?? "").trim(),
    repEmail: String(data.rep_email ?? "").trim(),
    repPhone: String(data.rep_phone ?? "").trim(),
    repBusinessTitle: String(data.rep_business_title ?? "").trim(),
    repJobPosition: String(data.rep_job_position ?? "").trim(),
    sampleMessage1: String(data.sample_message_1 ?? "").trim(),
    sampleMessage2: String(data.sample_message_2 ?? "").trim(),
    messagingPurpose: data.messaging_purpose ? String(data.messaging_purpose) : null,
  };
}

async function setRegistrationPhase(input: {
  venueId: string;
  toPhase: TextingPhase;
  attentionCode?: string | null;
  attentionMessage?: string | null;
  attentionFixHint?: string | null;
  supportDebug?: Record<string, unknown>;
}): Promise<void> {
  const admin = createAdminClient();
  const { data: current } = await admin
    .from("venue_texting_registrations")
    .select("phase")
    .eq("venue_id", input.venueId)
    .maybeSingle();
  const from = (current?.phase as TextingPhase | undefined) ?? "information_saved";
  if (from === input.toPhase) {
    const patch: Record<string, unknown> = {
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (input.attentionCode !== undefined) patch.attention_code = input.attentionCode;
    if (input.attentionMessage !== undefined) patch.attention_message = input.attentionMessage;
    if (input.attentionFixHint !== undefined) patch.attention_fix_hint = input.attentionFixHint;
    if (input.supportDebug) patch.support_debug = input.supportDebug;
    await admin.from("venue_texting_registrations").update(patch).eq("venue_id", input.venueId);
    return;
  }
  try {
    assertTextingPhaseTransition(from, input.toPhase);
  } catch {
    // Provider sync may jump from information_saved → needs_attention etc.
    // Allow service_role updates when transition table rejects edge cases after rejection.
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
  if (input.supportDebug) patch.support_debug = input.supportDebug;
  const { error } = await admin
    .from("venue_texting_registrations")
    .update(patch)
    .eq("venue_id", input.venueId);
  if (error) throw new Error(error.message);
}

async function venueCredentials(
  venueId: string,
  accountSid: string,
): Promise<TwilioCredentials> {
  const transient = transientByVenue.get(venueId);
  if (transient?.authToken) {
    return { accountSid, authToken: transient.authToken };
  }
  try {
    const secret = await loadVenueTwilioSecret(accountSid);
    return { accountSid: secret.accountSid, authToken: secret.authToken };
  } catch {
    if (transient?.authToken) {
      return { accountSid, authToken: transient.authToken };
    }
    throw new Error("Venue Twilio credentials are not available yet.");
  }
}

function firstIncomplete(
  rows: Awaited<ReturnType<typeof listProvisioningSteps>>,
): TextingProvisioningStep | null {
  for (const step of TEXTING_PROVISIONING_STEPS) {
    const row = rows.find((r) => r.step === step);
    if (!row || row.status !== "succeeded") return step;
  }
  return null;
}

export async function enqueueVenueTextingProvisioning(venueId: string): Promise<void> {
  assertVenueAllowedForSelfServiceProvisioning(venueId);
  await ensureProvisioningSteps(venueId, 1);
}

export async function processVenueTextingProvisioning(
  venueId: string,
  opts?: { explicitResume?: boolean },
): Promise<{
  advanced: boolean;
  step: TextingProvisioningStep | null;
  waiting?: boolean;
  error?: string;
}> {
  if (isProtectedTextingVenueId(venueId)) {
    return { advanced: false, step: null, error: "protected_venue" };
  }

  let account = await getVenueTwilioAccountExtended(venueId);
  if (account?.status === "ready") {
    return { advanced: false, step: null };
  }

  const explicitResume = opts?.explicitResume === true;
  const registrationPhase = await loadRegistrationPhase(venueId);
  // Scheduler/sync must stop after Needs attention. Only an explicit
  // submitRegistration resume may reopen terminal compliance steps.
  if (
    !explicitResume
    && (registrationPhase === "needs_attention" || registrationPhase === "failed")
  ) {
    return { advanced: false, step: null, error: "needs_attention_wait_for_explicit_resume" };
  }

  const forceNewAfterRejection = explicitResume
    && (registrationPhase === "needs_attention" || registrationPhase === "failed");

  await ensureProvisioningSteps(venueId, 1);
  const steps = await listProvisioningSteps(venueId, 1);
  const step = firstIncomplete(steps);
  if (!step) {
    return { advanced: false, step: null };
  }

  const stepRow = await getProvisioningStep(venueId, step, 1);
  if (stepRow?.status === "succeeded") {
    return { advanced: false, step };
  }
  if (
    stepRow?.status === "failed"
    && isTerminalProvisioningErrorCode(stepRow.lastErrorCode)
    && !explicitResume
  ) {
    return { advanced: false, step, error: stepRow.lastErrorMessage ?? "terminal_failure" };
  }

  if (forceNewAfterRejection && stepRow?.status === "failed") {
    const admin = createAdminClient();
    await admin
      .from("venue_texting_provisioning_steps")
      .update({
        status: "pending",
        last_error_code: null,
        last_error_message: null,
        next_attempt_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("venue_id", venueId)
      .eq("generation", 1)
      .eq("step", step);
  }

  await markStepRunning(venueId, step, 1);
  account = account ?? (await getVenueTwilioAccountExtended(venueId));
  const business = await loadBusiness(venueId);

  try {
    switch (step) {
      case "create_subaccount": {
        if (account?.twilioAccountSid) {
          await markStepSucceeded({
            venueId,
            step,
            resourceSid: account.twilioAccountSid,
          });
          break;
        }
        const outcome = await createVenueSubaccount({
          venueId,
          friendlyName: `HTC venue ${venueId.slice(0, 8)}`,
        });
        if (!outcome.ok) throw Object.assign(new Error(outcome.message), outcome);
        const authToken = String(outcome.detail?.auth_token ?? "");
        transientByVenue.set(venueId, { ...(transientByVenue.get(venueId) ?? {}), authToken });
        account = await upsertVenueTwilioAccount({
          venueId,
          twilioAccountSid: outcome.resourceSid!,
          messagingServiceSid: null,
          status: "provisioning",
          statusDetail: "Creating texting setup",
        });
        await markStepSucceeded({
          venueId,
          step,
          resourceSid: outcome.resourceSid,
        });
        break;
      }
      case "create_api_key": {
        account = account ?? (await getVenueTwilioAccountExtended(venueId));
        if (!account?.twilioAccountSid) throw new Error("Missing subaccount.");
        const existingSecret = await getProvisioningStep(venueId, "store_secret", 1);
        if (existingSecret?.status === "succeeded") {
          await markStepSucceeded({ venueId, step, resourceSid: account.twilioAccountSid });
          break;
        }
        const creds = await venueCredentials(venueId, account.twilioAccountSid);
        const outcome = await createVenueApiKey({
          venueId,
          accountSid: account.twilioAccountSid,
          authToken: creds.authToken,
          friendlyName: `HTC venue key ${venueId.slice(0, 8)}`,
        });
        if (!outcome.ok) throw Object.assign(new Error(outcome.message), outcome);
        transientByVenue.set(venueId, {
          ...(transientByVenue.get(venueId) ?? {}),
          authToken: creds.authToken,
          apiKeySid: outcome.resourceSid!,
          apiKeySecret: String(outcome.detail?.secret ?? ""),
        });
        await markStepSucceeded({ venueId, step, resourceSid: outcome.resourceSid });
        break;
      }
      case "store_secret": {
        account = account ?? (await getVenueTwilioAccountExtended(venueId));
        if (!account?.twilioAccountSid) throw new Error("Missing subaccount.");
        const t = transientByVenue.get(venueId);
        let authToken = t?.authToken;
        let apiKeySid = t?.apiKeySid;
        let apiKeySecret = t?.apiKeySecret;
        if (!authToken || !apiKeySid || !apiKeySecret) {
          // Already stored in a prior run — verify load.
          try {
            await loadVenueTwilioSecret(account.twilioAccountSid);
            await markStepSucceeded({ venueId, step, resourceSid: account.twilioAccountSid });
            break;
          } catch {
            throw new Error("API key material missing; cannot store venue secret.");
          }
        }
        const outcome = await storeVenueTwilioSecret({
          venueId,
          accountSid: account.twilioAccountSid,
          authToken,
          apiKeySid,
          apiKeySecret,
        });
        if (!outcome.ok) throw Object.assign(new Error(outcome.message), outcome);
        await markStepSucceeded({ venueId, step, resourceSid: account.twilioAccountSid });
        break;
      }
      case "create_messaging_service": {
        account = account ?? (await getVenueTwilioAccountExtended(venueId));
        if (!account?.twilioAccountSid) throw new Error("Missing subaccount.");
        if (account.messagingServiceSid) {
          await markStepSucceeded({
            venueId,
            step,
            resourceSid: account.messagingServiceSid,
          });
          break;
        }
        const creds = await venueCredentials(venueId, account.twilioAccountSid);
        const base = appBaseUrl();
        const outcome = await createVenueMessagingService({
          venueId,
          credentials: creds,
          friendlyName: `HTC ${business?.legalBusinessName || venueId.slice(0, 8)}`.slice(0, 64),
          inboundUrl: `${base}/api/messaging/sms-inbound`,
          fallbackUrl: `${base}/api/messaging/sms-inbound`,
          statusCallbackUrl: `${base}/api/messaging/sms-status`,
        });
        if (!outcome.ok) throw Object.assign(new Error(outcome.message), outcome);
        await upsertVenueTwilioAccount({
          venueId,
          messagingServiceSid: outcome.resourceSid!,
          status: "provisioning",
        });
        await markStepSucceeded({ venueId, step, resourceSid: outcome.resourceSid });
        break;
      }
      case "configure_webhooks": {
        account = account ?? (await getVenueTwilioAccountExtended(venueId));
        if (!account?.twilioAccountSid || !account.messagingServiceSid) {
          throw new Error("Missing messaging service.");
        }
        const creds = await venueCredentials(venueId, account.twilioAccountSid);
        const base = appBaseUrl();
        const outcome = await configureMessagingServiceWebhooks({
          venueId,
          credentials: creds,
          messagingServiceSid: account.messagingServiceSid,
          inboundUrl: `${base}/api/messaging/sms-inbound`,
          fallbackUrl: `${base}/api/messaging/sms-inbound`,
          statusCallbackUrl: `${base}/api/messaging/sms-status`,
        });
        if (!outcome.ok) throw Object.assign(new Error(outcome.message), outcome);
        await markStepSucceeded({ venueId, step, resourceSid: account.messagingServiceSid });
        break;
      }
      case "submit_secondary_profile": {
        if (!business?.legalBusinessName || !business.registrationNumber) {
          await setRegistrationPhase({
            venueId,
            toPhase: "details_needed",
            attentionCode: "details_needed",
            attentionMessage: "We still need a few business details before texting setup can continue.",
            attentionFixHint: "Complete the highlighted fields and submit again.",
          });
          throw Object.assign(new Error("Missing required business details."), {
            retryable: false,
            code: "details_needed",
          });
        }
        account = account ?? (await getVenueTwilioAccountExtended(venueId));
        if (!account?.twilioAccountSid) throw new Error("Missing subaccount.");
        const creds = await venueCredentials(venueId, account.twilioAccountSid);
        const outcome = await submitSecondaryCustomerProfile({
          venueId,
          credentials: creds,
          business,
          existingSid: forceNewAfterRejection ? null : account.secondaryProfileSid,
          forceNewAfterRejection,
        });
        if (!outcome.ok) {
          if (outcome.code === "secondary_rejected" || outcome.code === "secondary_rejected_only") {
            await setRegistrationPhase({
              venueId,
              toPhase: "needs_attention",
              attentionCode: "secondary_rejected",
              attentionMessage:
                outcome.message
                || "Twilio rejected the business profile. Update your business details and submit again.",
              attentionFixHint: "Correct the rejected business information, then explicitly resubmit.",
              supportDebug: outcome.detail,
            });
            await upsertVenueTwilioAccount({
              venueId,
              status: "error",
              statusDetail: outcome.message,
            });
          }
          throw Object.assign(new Error(outcome.message), outcome);
        }
        await upsertVenueTwilioAccount({
          venueId,
          secondaryProfileSid: outcome.resourceSid!,
          complianceSubmittedAt: new Date().toISOString(),
          status: "pending_compliance",
          statusDetail: "Business profile submitted",
        });
        await setRegistrationPhase({ venueId, toPhase: "under_review" });
        await markStepSucceeded({ venueId, step, resourceSid: outcome.resourceSid });
        break;
      }
      case "submit_a2p_trust_product": {
        account = account ?? (await getVenueTwilioAccountExtended(venueId));
        if (!account?.twilioAccountSid || !account.secondaryProfileSid || !business) {
          throw new Error("Missing secondary profile or business details.");
        }
        const creds = await venueCredentials(venueId, account.twilioAccountSid);
        const outcome = await submitA2pTrustProduct({
          venueId,
          credentials: creds,
          secondaryProfileSid: account.secondaryProfileSid,
          business,
          existingSid: forceNewAfterRejection ? null : account.a2pTrustProductSid,
          forceNewAfterRejection,
        });
        if (!outcome.ok) {
          if (outcome.code === "trust_product_rejected") {
            await setRegistrationPhase({
              venueId,
              toPhase: "needs_attention",
              attentionCode: "trust_product_rejected",
              attentionMessage: outcome.message,
              attentionFixHint: "Correct your business details, then explicitly resubmit.",
              supportDebug: outcome.detail,
            });
            await upsertVenueTwilioAccount({
              venueId,
              status: "error",
              statusDetail: outcome.message,
            });
          }
          throw Object.assign(new Error(outcome.message), outcome);
        }
        await upsertVenueTwilioAccount({
          venueId,
          a2pTrustProductSid: outcome.resourceSid!,
          complianceSubmittedAt: account.complianceSubmittedAt ?? new Date().toISOString(),
          status: "pending_compliance",
        });
        await markStepSucceeded({ venueId, step, resourceSid: outcome.resourceSid });
        break;
      }
      case "submit_brand": {
        account = account ?? (await getVenueTwilioAccountExtended(venueId));
        if (!account?.twilioAccountSid || !account.secondaryProfileSid || !account.a2pTrustProductSid) {
          throw new Error("Missing profile/trust for Brand.");
        }
        const creds = await venueCredentials(venueId, account.twilioAccountSid);
        const outcome = await submitBrandRegistration({
          venueId,
          credentials: creds,
          secondaryProfileSid: account.secondaryProfileSid,
          trustProductSid: account.a2pTrustProductSid,
          existingSid: forceNewAfterRejection ? null : account.a2pBrandSid,
          forceNewAfterRejection,
        });
        if (!outcome.ok) {
          if (outcome.code === "FAILED" || outcome.code === "SUSPENDED") {
            await setRegistrationPhase({
              venueId,
              toPhase: "needs_attention",
              attentionCode: "brand_rejected",
              attentionMessage:
                "We couldn’t finish texting registration with the business details on file.",
              attentionFixHint: "Review your business details and resubmit, or contact support.",
              supportDebug: outcome.detail,
            });
            await upsertVenueTwilioAccount({
              venueId,
              a2pBrandStatus: outcome.code,
              status: "error",
              statusDetail: outcome.message,
            });
          }
          throw Object.assign(new Error(outcome.message), outcome);
        }
        await upsertVenueTwilioAccount({
          venueId,
          a2pBrandSid: outcome.resourceSid!,
          a2pBrandStatus: String(outcome.detail?.status ?? "PENDING"),
          status: "pending_compliance",
        });
        await setRegistrationPhase({ venueId, toPhase: "under_review" });
        await markStepSucceeded({ venueId, step, resourceSid: outcome.resourceSid });
        break;
      }
      case "await_brand_approved": {
        account = account ?? (await getVenueTwilioAccountExtended(venueId));
        if (!account?.twilioAccountSid || !account.a2pBrandSid) {
          throw new Error("Missing Brand.");
        }
        const creds = await venueCredentials(venueId, account.twilioAccountSid);
        const outcome = await fetchBrandStatus({
          credentials: creds,
          brandSid: account.a2pBrandSid,
        });
        if (!outcome.ok) {
          await upsertVenueTwilioAccount({
            venueId,
            a2pBrandStatus: outcome.code ?? "FAILED",
            status: "error",
            statusDetail: outcome.message,
          });
          await setRegistrationPhase({
            venueId,
            toPhase: "needs_attention",
            attentionCode: "brand_rejected",
            attentionMessage:
              "We couldn’t finish texting registration with the business details on file.",
            attentionFixHint: "Review your business details and resubmit, or contact support.",
            supportDebug: outcome.detail,
          });
          throw Object.assign(new Error(outcome.message), outcome);
        }
        await upsertVenueTwilioAccount({
          venueId,
          a2pBrandStatus: String(outcome.detail?.status ?? "PENDING"),
        });
        if (outcome.waiting) {
          await markStepFailed({
            venueId,
            step,
            errorMessage: "Waiting for Brand approval",
            errorCode: "waiting",
            retryAt: new Date(Date.now() + 30_000),
          });
          // Re-queue as pending wait (not a hard fail for venue UI)
          const admin = createAdminClient();
          await admin
            .from("venue_texting_provisioning_steps")
            .update({
              status: "pending",
              last_error_message: "Waiting for Brand approval",
              next_attempt_at: new Date(Date.now() + 30_000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("venue_id", venueId)
            .eq("step", step);
          return { advanced: false, step, waiting: true };
        }
        await markStepSucceeded({ venueId, step, resourceSid: account.a2pBrandSid });
        break;
      }
      case "submit_campaign": {
        // ONLY after Brand APPROVED — enforced by await_brand_approved succeeding first.
        account = account ?? (await getVenueTwilioAccountExtended(venueId));
        if (!account?.twilioAccountSid || !account.messagingServiceSid || !account.a2pBrandSid) {
          throw new Error("Missing Brand or Messaging Service for Campaign.");
        }
        if ((account.a2pBrandStatus ?? "").toUpperCase() !== "APPROVED") {
          throw new Error("Refusing Campaign create until Brand is APPROVED.");
        }
        if (account.a2pCampaignSid) {
          await markStepSucceeded({ venueId, step, resourceSid: account.a2pCampaignSid });
          break;
        }
        if (!business?.sampleMessage1 || !business.sampleMessage2) {
          throw new Error("Sample messages required for Campaign.");
        }
        const creds = await venueCredentials(venueId, account.twilioAccountSid);
        const outcome = await submitCampaign({
          venueId,
          credentials: creds,
          messagingServiceSid: account.messagingServiceSid,
          brandSid: account.a2pBrandSid,
          brandName: business.legalBusinessName,
          sampleMessage1: business.sampleMessage1,
          sampleMessage2: business.sampleMessage2,
        });
        if (!outcome.ok) throw Object.assign(new Error(outcome.message), outcome);
        await upsertVenueTwilioAccount({
          venueId,
          a2pCampaignSid: outcome.resourceSid!,
          a2pCampaignStatus: String(outcome.detail?.status ?? "IN_PROGRESS"),
          status: "pending_compliance",
        });
        await setRegistrationPhase({ venueId, toPhase: "under_review" });
        await markStepSucceeded({ venueId, step, resourceSid: outcome.resourceSid });
        break;
      }
      case "await_campaign_verified": {
        account = account ?? (await getVenueTwilioAccountExtended(venueId));
        if (!account?.twilioAccountSid || !account.messagingServiceSid || !account.a2pCampaignSid) {
          throw new Error("Missing Campaign.");
        }
        const creds = await venueCredentials(venueId, account.twilioAccountSid);
        const outcome = await fetchCampaignStatus({
          credentials: creds,
          messagingServiceSid: account.messagingServiceSid,
          campaignSid: account.a2pCampaignSid,
        });
        if (!outcome.ok) {
          await upsertVenueTwilioAccount({
            venueId,
            a2pCampaignStatus: outcome.code ?? "FAILED",
            status: "error",
            statusDetail: outcome.message,
          });
          await setRegistrationPhase({
            venueId,
            toPhase: "needs_attention",
            attentionCode: "campaign_rejected",
            attentionMessage:
              "Your texting registration needs a few adjustments before it can be approved.",
            attentionFixHint: "Update your messaging samples or business details, then resubmit.",
            supportDebug: outcome.detail,
          });
          throw Object.assign(new Error(outcome.message), outcome);
        }
        await upsertVenueTwilioAccount({
          venueId,
          a2pCampaignStatus: String(outcome.detail?.status ?? "IN_PROGRESS"),
        });
        if (outcome.waiting) {
          const admin = createAdminClient();
          await admin
            .from("venue_texting_provisioning_steps")
            .update({
              status: "pending",
              last_error_message: "Waiting for Campaign verification",
              next_attempt_at: new Date(Date.now() + 30_000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("venue_id", venueId)
            .eq("step", step);
          return { advanced: false, step, waiting: true };
        }
        await setRegistrationPhase({ venueId, toPhase: "setting_up_number" });
        await markStepSucceeded({ venueId, step, resourceSid: account.a2pCampaignSid });
        break;
      }
      case "buy_number": {
        account = account ?? (await getVenueTwilioAccountExtended(venueId));
        if (!account?.twilioAccountSid) throw new Error("Missing subaccount.");
        if ((account.a2pCampaignStatus ?? "").toUpperCase() !== "VERIFIED"
          && (account.a2pCampaignStatus ?? "").toUpperCase() !== "APPROVED") {
          throw new Error("Refusing phone purchase until Campaign is verified.");
        }
        if (account.phoneNumberSid && account.defaultFromE164) {
          await markStepSucceeded({ venueId, step, resourceSid: account.phoneNumberSid });
          break;
        }
        const creds = await venueCredentials(venueId, account.twilioAccountSid);
        const outcome = await buyVenuePhoneNumber({
          venueId,
          credentials: creds,
          existingSid: account.phoneNumberSid,
        });
        if (!outcome.ok) throw Object.assign(new Error(outcome.message), outcome);
        await upsertVenueTwilioAccount({
          venueId,
          phoneNumberSid: outcome.resourceSid!,
          defaultFromE164: String(outcome.detail?.e164 ?? account.defaultFromE164 ?? ""),
          status: "pending_compliance",
          statusDetail: "Setting up texting number",
        });
        await setRegistrationPhase({ venueId, toPhase: "setting_up_number" });
        await markStepSucceeded({ venueId, step, resourceSid: outcome.resourceSid });
        break;
      }
      case "attach_number": {
        account = account ?? (await getVenueTwilioAccountExtended(venueId));
        if (!account?.twilioAccountSid || !account.messagingServiceSid || !account.phoneNumberSid) {
          throw new Error("Missing phone or Messaging Service.");
        }
        const creds = await venueCredentials(venueId, account.twilioAccountSid);
        const outcome = await attachPhoneToMessagingService({
          credentials: creds,
          messagingServiceSid: account.messagingServiceSid,
          phoneNumberSid: account.phoneNumberSid,
        });
        if (!outcome.ok) throw Object.assign(new Error(outcome.message), outcome);
        await markStepSucceeded({ venueId, step, resourceSid: account.phoneNumberSid });
        break;
      }
      case "await_number_a2p": {
        // Mock / sandbox: treat attached number as registered once attached.
        account = account ?? (await getVenueTwilioAccountExtended(venueId));
        await upsertVenueTwilioAccount({
          venueId,
          phoneA2pStatus: "REGISTERED",
        });
        await markStepSucceeded({
          venueId,
          step,
          resourceSid: account?.phoneNumberSid ?? null,
        });
        break;
      }
      case "mark_ready": {
        account = account ?? (await getVenueTwilioAccountExtended(venueId));
        if (!account?.phoneNumberSid || !account.defaultFromE164 || !account.a2pCampaignSid) {
          throw new Error("Cannot mark ready — missing sender or campaign.");
        }
        await upsertVenueTwilioAccount({
          venueId,
          status: "ready",
          statusDetail: null,
          a2pBrandStatus: account.a2pBrandStatus ?? "APPROVED",
          a2pCampaignStatus: account.a2pCampaignStatus ?? "VERIFIED",
          phoneA2pStatus: account.phoneA2pStatus ?? "REGISTERED",
        });
        await setRegistrationPhase({ venueId, toPhase: "ready" });
        await markStepSucceeded({ venueId, step, resourceSid: account.twilioAccountSid });
        transientByVenue.delete(venueId);
        break;
      }
      default:
        throw new Error(`Unknown provisioning step: ${step}`);
    }

    return { advanced: true, step };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Provisioning step failed.";
    const retryable = Boolean(
      err && typeof err === "object" && "retryable" in err
        ? (err as { retryable?: boolean }).retryable
        : true,
    );
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code?: unknown }).code ?? "")
        : null;
    const attempt = (stepRow?.attemptCount ?? 0) + 1;
    await markStepFailed({
      venueId,
      step,
      errorCode: code,
      errorMessage: message,
      retryAt: provisioningRetryAt(retryable, attempt),
      supportDebug: err && typeof err === "object" && "detail" in err
        ? (err as { detail?: Record<string, unknown> }).detail
        : { message },
    });
    console.error("[texting-provisioning]", {
      venueId,
      step,
      code,
      message,
      retryable,
      timestamp: new Date().toISOString(),
    });
    return { advanced: false, step, error: message };
  }
}

export async function processTextingProvisioningQueue(limit = 5): Promise<{
  processed: number;
  advanced: number;
  waiting: number;
  failed: number;
}> {
  const venueIds = await claimDueProvisioningVenueIds(limit);
  let advanced = 0;
  let waiting = 0;
  let failed = 0;
  for (const venueId of venueIds) {
    const result = await processVenueTextingProvisioning(venueId);
    if (result.advanced) advanced += 1;
    else if (result.waiting) waiting += 1;
    else if (result.error) failed += 1;
  }
  return { processed: venueIds.length, advanced, waiting, failed };
}
