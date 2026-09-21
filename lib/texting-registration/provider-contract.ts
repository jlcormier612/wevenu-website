/**
 * Provider orchestration contract for texting enablement.
 *
 * When TEXTING_SELF_SERVICE_ENABLED (or sandbox default), uses the live
 * Twilio ISV provisioning orchestrator. Otherwise ops-first deferred mode.
 */
import { isTextingSelfServiceProvisioningEnabled } from "@/lib/texting-provisioning/feature";
import { LiveTextingProviderOrchestrator } from "@/lib/texting-provisioning/live-orchestrator";

export type TextingProviderSubmitResult =
  | { ok: true; accepted: true }
  | { ok: true; accepted: false; deferred: true; reason: string }
  | { ok: false; message: string };

export type TextingProviderSyncResult =
  | {
      ok: true;
      /** Suggested HTC phase from provider state — caller still validates transitions. */
      suggestedPhase?:
        | "under_review"
        | "needs_attention"
        | "setting_up_number"
        | "ready"
        | "paused"
        | "failed";
      attentionCode?: string;
      attentionMessage?: string;
      attentionFixHint?: string;
      /** Ops-only; never shown in venue UI. */
      supportDebug?: Record<string, unknown>;
      textingNumberE164?: string | null;
    }
  | { ok: false; message: string };

export interface TextingProviderOrchestrator {
  submitRegistration(venueId: string): Promise<TextingProviderSubmitResult>;
  syncRegistration(venueId: string): Promise<TextingProviderSyncResult>;
}

/**
 * Ops-first orchestrator — records that HTC accepted the venue's details.
 * Does not call Twilio APIs. Venue-facing reason must stay jargon-free.
 */
export class OpsFirstTextingProviderOrchestrator
  implements TextingProviderOrchestrator
{
  async submitRegistration(
    _venueId: string,
  ): Promise<TextingProviderSubmitResult> {
    return {
      ok: true,
      accepted: false,
      deferred: true,
      reason:
        "Your information is saved. Hello to Cheers is setting up texting for your venue.",
    };
  }

  async syncRegistration(
    _venueId: string,
  ): Promise<TextingProviderSyncResult> {
    return {
      ok: true,
    };
  }
}

/** @deprecated Alias — same ops-first behavior (no live Twilio API). */
export const DeferredTextingProviderOrchestrator = OpsFirstTextingProviderOrchestrator;

function defaultOrchestrator(): TextingProviderOrchestrator {
  if (isTextingSelfServiceProvisioningEnabled()) {
    return new LiveTextingProviderOrchestrator();
  }
  return new OpsFirstTextingProviderOrchestrator();
}

let orchestrator: TextingProviderOrchestrator = defaultOrchestrator();

export function getTextingProviderOrchestrator(): TextingProviderOrchestrator {
  return orchestrator;
}

/** Test / future wiring — swap orchestrator without changing HTC UX. */
export function setTextingProviderOrchestrator(
  next: TextingProviderOrchestrator,
): void {
  orchestrator = next;
}
