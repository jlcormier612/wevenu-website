/**
 * HTC texting registration lifecycle — valid transitions only.
 * Invalid transitions throw; they must never silently occur.
 */
import type { TextingPhase } from "@/lib/texting-registration/types";
import {
  PROVIDER_AUTHORITATIVE_TEXTING_PHASES,
  TEXTING_PHASES,
  VENUE_WRITABLE_TEXTING_PHASES,
} from "@/lib/texting-registration/types";

const ALLOWED: Record<TextingPhase, readonly TextingPhase[]> = {
  not_started: ["details_needed"],
  details_needed: ["details_needed", "information_saved", "under_review"],
  information_saved: ["details_needed", "information_saved", "under_review"],
  under_review: ["needs_attention", "setting_up_number", "failed", "information_saved"],
  needs_attention: ["details_needed", "information_saved", "under_review", "failed"],
  setting_up_number: ["ready", "failed", "needs_attention"],
  ready: ["paused", "failed"],
  paused: ["ready", "failed", "needs_attention"],
  failed: ["details_needed", "information_saved", "under_review"],
};

export function isTextingPhase(value: string): value is TextingPhase {
  return (TEXTING_PHASES as readonly string[]).includes(value);
}

export function isVenueWritableTextingPhase(phase: TextingPhase): boolean {
  return (VENUE_WRITABLE_TEXTING_PHASES as readonly string[]).includes(phase);
}

export function isProviderAuthoritativeTextingPhase(phase: TextingPhase): boolean {
  return (PROVIDER_AUTHORITATIVE_TEXTING_PHASES as readonly string[]).includes(phase);
}

export function canTransitionTextingPhase(
  from: TextingPhase,
  to: TextingPhase,
): boolean {
  if (from === to && (from === "details_needed" || from === "information_saved")) {
    return true;
  }
  return ALLOWED[from].includes(to);
}

export function assertTextingPhaseTransition(
  from: TextingPhase,
  to: TextingPhase,
): void {
  if (!canTransitionTextingPhase(from, to)) {
    throw new Error(`Invalid texting registration transition: ${from} → ${to}`);
  }
}

/** Phases where the venue may edit questionnaire fields. */
export function canEditTextingRegistration(phase: TextingPhase): boolean {
  return phase === "not_started"
    || phase === "details_needed"
    || phase === "information_saved"
    || phase === "needs_attention"
    || phase === "failed";
}

export function canSubmitTextingRegistration(phase: TextingPhase): boolean {
  return phase === "details_needed"
    || phase === "information_saved"
    || phase === "needs_attention"
    || phase === "failed";
}

export function canResubmitTextingRegistration(phase: TextingPhase): boolean {
  return phase === "needs_attention" || phase === "failed" || phase === "information_saved";
}

/**
 * Post-submit phase when the provider orchestrator has not actually accepted.
 * Must not use under_review (that means provider registration is underway).
 */
export function phaseAfterProviderSubmit(result: {
  ok: true;
  accepted: true;
} | {
  ok: true;
  accepted: false;
  deferred: true;
  reason: string;
} | {
  ok: false;
  message: string;
}): TextingPhase {
  if (result.ok && "accepted" in result && result.accepted === true) {
    return "under_review";
  }
  return "information_saved";
}
