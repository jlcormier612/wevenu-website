/**
 * Continue self-service provisioning after a verified phone REGISTERED event.
 * Bounded, idempotent; never invents readiness — processVenueTextingProvisioning
 * still enforces Brand/Campaign/phone gates.
 *
 * Intentionally does not statically import processor.ts (avoids a cycle:
 * processor → advanceProvisioningUntilSettled → processVenue…).
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { getVenueTwilioAccountExtended } from "@/lib/texting-provisioning/account-repository";
import { isPhoneA2pRegistered } from "@/lib/texting-provisioning/phone-a2p-status";

export type ProvisioningProcessResult = {
  advanced: boolean;
  step: string | null;
  waiting?: boolean;
  error?: string;
};

export type ResumeAfterPhoneRegisteredResult = {
  stepsAdvanced: number;
  ready: boolean;
  waiting: boolean;
  error?: string;
};

/** Pure: only resume when phone status is explicitly registered-class. */
export function shouldResumeProvisioningAfterPhoneStatus(
  phoneA2pStatus: string | null | undefined,
): boolean {
  return isPhoneA2pRegistered(phoneA2pStatus);
}

/**
 * Make await_number_a2p / mark_ready due immediately so the queue can recover
 * even if the inline resume pass does not finish Ready in one request.
 */
export async function markPhoneRegistrationStepsDueNow(venueId: string): Promise<void> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  await admin
    .from("venue_texting_provisioning_steps")
    .update({
      status: "pending",
      next_attempt_at: now,
      last_error_code: "waiting",
      last_error_message: "Phone registration verified — resuming setup",
      updated_at: now,
    })
    .eq("venue_id", venueId)
    .eq("generation", 1)
    .in("step", ["await_number_a2p", "mark_ready"])
    .in("status", ["pending", "failed", "running"]);
}

/**
 * Advance provisioning steps until ready, waiting, error, or maxSteps.
 * Inject processFn in tests.
 */
export async function advanceProvisioningUntilSettled(input: {
  venueId: string;
  maxSteps?: number;
  processFn?: (venueId: string) => Promise<ProvisioningProcessResult>;
  isReadyFn?: (venueId: string) => Promise<boolean>;
}): Promise<ResumeAfterPhoneRegisteredResult> {
  const maxSteps = input.maxSteps ?? 4;
  const processFn =
    input.processFn
    ?? (await import("@/lib/texting-provisioning/processor")).processVenueTextingProvisioning;
  const isReadyFn = input.isReadyFn ?? (async (venueId: string) => {
    const account = await getVenueTwilioAccountExtended(venueId);
    return account?.status === "ready";
  });

  let stepsAdvanced = 0;
  for (let i = 0; i < maxSteps; i += 1) {
    if (await isReadyFn(input.venueId)) {
      return { stepsAdvanced, ready: true, waiting: false };
    }

    const result = await processFn(input.venueId);
    if (result.advanced) stepsAdvanced += 1;

    if (result.waiting) {
      return { stepsAdvanced, ready: false, waiting: true };
    }

    if (result.error && !result.advanced) {
      return {
        stepsAdvanced,
        ready: false,
        waiting: false,
        error: result.error,
      };
    }

    if (!result.advanced) {
      const ready = await isReadyFn(input.venueId);
      return { stepsAdvanced, ready, waiting: false };
    }
  }

  const ready = await isReadyFn(input.venueId);
  return { stepsAdvanced, ready, waiting: !ready };
}

/**
 * Called after a verified REGISTERED Event Streams apply.
 * Never called for pending/failed/deregistered statuses.
 */
export async function resumeVenueTextingProvisioningAfterPhoneRegistered(
  venueId: string,
): Promise<ResumeAfterPhoneRegisteredResult> {
  const account = await getVenueTwilioAccountExtended(venueId);
  if (!shouldResumeProvisioningAfterPhoneStatus(account?.phoneA2pStatus)) {
    return {
      stepsAdvanced: 0,
      ready: false,
      waiting: false,
      error: "phone_not_registered",
    };
  }

  await markPhoneRegistrationStepsDueNow(venueId);
  return advanceProvisioningUntilSettled({ venueId, maxSteps: 4 });
}
