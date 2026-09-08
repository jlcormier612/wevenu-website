/**
 * Provider orchestration contract for texting enablement.
 *
 * Track A implements the HTC side only. Live Twilio provisioning, Trust Hub,
 * A2P, number purchase, Secrets Manager writes, and webhook wiring belong to
 * a future Track B orchestrator that plugs in behind this interface.
 *
 * Eventual flow (not implemented here):
 *   venue → provider account → credentials → registration →
 *   messaging service → number → webhooks → provider binding → ready
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
   * Must not throw provider jargon to the venue; return deferred until Track B.
   */
  submitRegistration(venueId: string): Promise<TextingProviderSubmitResult>;

  /** Poll/map provider status into HTC-friendly fields. */
  syncRegistration(venueId: string): Promise<TextingProviderSyncResult>;
}

/**
 * Default Track A orchestrator — records that HTC accepted the submission
 * and waits for future provider automation. Does not call Twilio APIs.
 */
export class DeferredTextingProviderOrchestrator
  implements TextingProviderOrchestrator
{
  async submitRegistration(
    _venueId: string,
  ): Promise<TextingProviderSubmitResult> {
    return {
      ok: true,
      accepted: false,
      deferred: true,
      reason: "Provider provisioning is not enabled yet.",
    };
  }

  async syncRegistration(
    _venueId: string,
  ): Promise<TextingProviderSyncResult> {
    return {
      ok: true,
      suggestedPhase: "under_review",
    };
  }
}

let orchestrator: TextingProviderOrchestrator =
  new DeferredTextingProviderOrchestrator();

export function getTextingProviderOrchestrator(): TextingProviderOrchestrator {
  return orchestrator;
}

/** Test / future wiring — swap in a live orchestrator without changing HTC UX. */
export function setTextingProviderOrchestrator(
  next: TextingProviderOrchestrator,
): void {
  orchestrator = next;
}
