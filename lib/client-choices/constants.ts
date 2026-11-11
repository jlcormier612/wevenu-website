/**
 * Client Choices — shared constants (safe for client components).
 * Internal statuses preserve history; display collapses who-acts-next.
 */

export type ClientChoicesStatus =
  | "draft"
  | "sent"
  | "in_progress"
  | "submitted"
  | "changes_requested"
  | "resubmitted"
  | "finalized";

/** User-facing status — answers "Who needs to act next?" */
export type ClientChoicesDisplayStatus =
  | "draft"
  | "awaiting_client"
  | "client_submitted"
  | "changes_requested"
  | "finalized";

export const CLIENT_CHOICES_DISPLAY_LABEL: Record<ClientChoicesDisplayStatus, string> = {
  draft: "Draft",
  awaiting_client: "Awaiting Client",
  client_submitted: "Client Submitted",
  changes_requested: "Changes Requested",
  finalized: "Finalized",
};

export function toClientChoicesDisplayStatus(status: string): ClientChoicesDisplayStatus {
  switch (status) {
    case "draft":
      return "draft";
    case "sent":
    case "in_progress":
      return "awaiting_client";
    case "submitted":
    case "resubmitted":
      return "client_submitted";
    case "changes_requested":
      return "changes_requested";
    case "finalized":
      return "finalized";
    default:
      return "draft";
  }
}

export function clientChoicesDisplayLabel(status: string): string {
  return CLIENT_CHOICES_DISPLAY_LABEL[toClientChoicesDisplayStatus(status)];
}

export const CLIENT_CHOICES_CLIENT_EDITABLE: readonly ClientChoicesStatus[] = [
  "sent",
  "in_progress",
  "changes_requested",
] as const;

export const CLIENT_CHOICES_NEEDS_VENUE_REVIEW: readonly ClientChoicesStatus[] = [
  "submitted",
  "resubmitted",
] as const;

export function isClientChoicesClientEditable(status: string): boolean {
  return (CLIENT_CHOICES_CLIENT_EDITABLE as readonly string[]).includes(status);
}

export function isClientChoicesNeedsVenueReview(status: string): boolean {
  return (CLIENT_CHOICES_NEEDS_VENUE_REVIEW as readonly string[]).includes(status);
}

/** Next actor for UI banners / Documents experience. */
export function clientChoicesNextActor(status: string): "venue" | "client" | null {
  const d = toClientChoicesDisplayStatus(status);
  if (d === "draft" || d === "client_submitted") return "venue";
  if (d === "awaiting_client" || d === "changes_requested") return "client";
  return null;
}
