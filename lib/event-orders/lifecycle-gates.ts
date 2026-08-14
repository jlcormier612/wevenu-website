/**
 * Pure Event Order lifecycle / mutation gates.
 * Mirrors the application-layer rules in service.ts and representation.ts
 * so finalize / reopen / share / immutability stay regression-testable
 * without a live database.
 */
import type { EventOrderActionResult, EventOrderStatus } from "@/lib/event-orders/types";

export const EVENT_ORDER_FINALIZED_MUTATION_MESSAGE =
  "This Event Order is finalized — reopen it to make changes.";

export const EVENT_ORDER_ALREADY_FINALIZED_MESSAGE = "Already finalized.";

export const EVENT_ORDER_NOT_FINALIZED_REOPEN_MESSAGE =
  "This Event Order isn't finalized.";

export const EVENT_ORDER_SHARE_REQUIRES_FINALIZED_MESSAGE =
  "Mark the Event Order Ready before sharing it with the client.";

/** Application-layer guard shared by every section/line mutator. */
export function mutationBlockedWhenFinalized(
  status: EventOrderStatus,
): EventOrderActionResult | null {
  if (status === "finalized") {
    return { ok: false, message: EVENT_ORDER_FINALIZED_MUTATION_MESSAGE };
  }
  return null;
}

/** Finalize is refused when already finalized (service layer). */
export function finalizeBlockedWhenAlreadyFinalized(
  status: EventOrderStatus,
): EventOrderActionResult | null {
  if (status === "finalized") {
    return { ok: false, message: EVENT_ORDER_ALREADY_FINALIZED_MESSAGE };
  }
  return null;
}

/**
 * UI gate only — Finalize control is disabled with zero lines.
 * Service finalize does not re-check line count; empty finalize is prevented in UI.
 */
export function canAttemptFinalize(lineCount: number): boolean {
  return lineCount > 0;
}

/** Reopen is refused unless currently finalized. */
export function reopenBlockedWhenNotFinalized(
  status: EventOrderStatus,
): EventOrderActionResult | null {
  if (status !== "finalized") {
    return { ok: false, message: EVENT_ORDER_NOT_FINALIZED_REOPEN_MESSAGE };
  }
  return null;
}

/** Share-with-client is refused unless finalized. */
export function shareBlockedWhenNotFinalized(
  status: EventOrderStatus,
): EventOrderActionResult | null {
  if (status !== "finalized") {
    return { ok: false, message: EVENT_ORDER_SHARE_REQUIRES_FINALIZED_MESSAGE };
  }
  return null;
}

/**
 * Template → instance copy semantics (ensureEventOrder): lines are independent
 * custom rows; later template edits must not imply a live reference.
 */
export function templateAppliedLineProvenance(): "custom" {
  return "custom";
}
