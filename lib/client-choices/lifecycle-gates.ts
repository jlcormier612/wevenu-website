/**
 * Pure Client Choices lifecycle gates — regression-testable without DB.
 */
import type { ClientChoicesActionResult } from "@/lib/client-choices/types";
import {
  isClientChoicesClientEditable,
  isClientChoicesNeedsVenueReview,
} from "@/lib/client-choices/constants";

export const CLIENT_CHOICES_LOCKED_MESSAGE = "These choices are locked right now.";
export const CLIENT_CHOICES_FINALIZE_NOT_READY_MESSAGE =
  "Finalize is available after the client submits (or after you accept a revision).";
export const CLIENT_CHOICES_ALREADY_FINALIZED_MESSAGE = "Already finalized.";
export const CLIENT_CHOICES_SEND_DRAFT_ONLY_MESSAGE = "Only a draft can be sent.";
export const CLIENT_CHOICES_REQUEST_CHANGES_MESSAGE =
  "Request changes is available while reviewing a client submission.";

export function clientSaveBlocked(status: string): ClientChoicesActionResult | null {
  if (!isClientChoicesClientEditable(status)) {
    return { ok: false, message: CLIENT_CHOICES_LOCKED_MESSAGE };
  }
  return null;
}

export function clientSubmitBlocked(status: string): ClientChoicesActionResult | null {
  return clientSaveBlocked(status);
}

export function sendBlocked(status: string): ClientChoicesActionResult | null {
  if (status !== "draft" && status !== "changes_requested") {
    // Allow re-send from draft only for first send; changes_requested uses request-changes path.
    if (status === "sent" || status === "in_progress") {
      return null; // re-notify ok
    }
  }
  if (status === "finalized") {
    return { ok: false, message: CLIENT_CHOICES_ALREADY_FINALIZED_MESSAGE };
  }
  if (status === "submitted" || status === "resubmitted") {
    return { ok: false, message: "Review the submission or request changes before sending again." };
  }
  return null;
}

export function firstSendBlocked(status: string): ClientChoicesActionResult | null {
  if (status !== "draft") {
    if (status === "sent" || status === "in_progress") return null;
    if (status === "finalized") return { ok: false, message: CLIENT_CHOICES_ALREADY_FINALIZED_MESSAGE };
    return { ok: false, message: CLIENT_CHOICES_SEND_DRAFT_ONLY_MESSAGE };
  }
  return null;
}

export function requestChangesBlocked(status: string): ClientChoicesActionResult | null {
  if (!isClientChoicesNeedsVenueReview(status)) {
    return { ok: false, message: CLIENT_CHOICES_REQUEST_CHANGES_MESSAGE };
  }
  return null;
}

export function finalizeBlocked(status: string): ClientChoicesActionResult | null {
  if (status === "finalized") {
    return { ok: false, message: CLIENT_CHOICES_ALREADY_FINALIZED_MESSAGE };
  }
  if (!isClientChoicesNeedsVenueReview(status)) {
    return { ok: false, message: CLIENT_CHOICES_FINALIZE_NOT_READY_MESSAGE };
  }
  return null;
}

/** Submit never mutates Event Order or invoice — enforced by service boundaries. */
export function submitMutatesFinancialSystems(): boolean {
  return false;
}

/** Only venue finalize applies to Event Order. */
export function finalizeAppliesToEventOrder(): boolean {
  return true;
}
