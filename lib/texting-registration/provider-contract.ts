/**
 * Provider orchestration contract for texting enablement.
 *
 * Track B dogfood is ops-first: Trust Hub / A2P / sender provisioning happens
 * outside the app. This interface records HTC acceptance of venue details and
 * syncs display from venue_twilio_accounts — it does not call Twilio APIs.
 *
 * Flow:
 *   venue saves details → ops provisions subaccount / compliance / sender →
 *   venue_twilio_accounts updated → app reflects ready only when sendable
 */

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
  /**
   * After HTC accepts a complete registration submit.
   * Ops-first Track B: never claims the app completed Twilio compliance.
   */
  submitRegistration(venueId: string): Promise<TextingProviderSubmitResult>;

  /** Poll/map provider status into HTC-friendly fields. */
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

let orchestrator: TextingProviderOrchestrator =
  new OpsFirstTextingProviderOrchestrator();

export function getTextingProviderOrchestrator(): TextingProviderOrchestrator {
  return orchestrator;
}

/** Test / future wiring — swap in a live orchestrator without changing HTC UX. */
export function setTextingProviderOrchestrator(
  next: TextingProviderOrchestrator,
): void {
  orchestrator = next;
}
