/**
 * Client floor-plan collaboration review lifecycle.
 * Working layout edits remain on the shared plan; this status tells both
 * sides when the couple is done and when the venue has responded.
 */

export const CLIENT_LAYOUT_STATUSES = [
  "working",
  "submitted",
  "changes_requested",
  "approved",
] as const;

export type ClientLayoutStatus = (typeof CLIENT_LAYOUT_STATUSES)[number];

export function normalizeClientLayoutStatus(value: unknown): ClientLayoutStatus {
  if (value === "submitted" || value === "changes_requested" || value === "approved") {
    return value;
  }
  return "working";
}

/** Client may rearrange / add furniture when status allows and plan is not Ready. */
export function clientMayEditLayout(opts: {
  clientLayoutStatus: ClientLayoutStatus | string | null | undefined;
  isReady: boolean;
}): boolean {
  if (opts.isReady) return false;
  const status = normalizeClientLayoutStatus(opts.clientLayoutStatus);
  return status === "working" || status === "changes_requested";
}

export function clientMaySubmitLayout(opts: {
  clientLayoutStatus: ClientLayoutStatus | string | null | undefined;
  isReady: boolean;
  isCoupleSelected: boolean;
}): boolean {
  if (opts.isReady || !opts.isCoupleSelected) return false;
  const status = normalizeClientLayoutStatus(opts.clientLayoutStatus);
  return status === "working" || status === "changes_requested";
}

export function venueMayReviewSubmission(opts: {
  clientLayoutStatus: ClientLayoutStatus | string | null | undefined;
}): boolean {
  return normalizeClientLayoutStatus(opts.clientLayoutStatus) === "submitted";
}

export function clientLayoutStatusLabel(status: ClientLayoutStatus | string | null | undefined): string {
  switch (normalizeClientLayoutStatus(status)) {
    case "submitted":
      return "Submitted — awaiting venue review";
    case "changes_requested":
      return "Changes requested";
    case "approved":
      return "Approved by venue";
    default:
      return "In progress";
  }
}

export function clientLayoutStatusHint(status: ClientLayoutStatus | string | null | undefined): string {
  switch (normalizeClientLayoutStatus(status)) {
    case "submitted":
      return "Your venue has your layout. Furniture placement is locked until they respond.";
    case "changes_requested":
      return "Your venue asked for updates. Make the changes, then submit again.";
    case "approved":
      return "Your venue approved this layout. Placement is locked.";
    default:
      return "Arrange unlocked furniture, add permitted tables if allowed, seat guests in Seating, then submit when you are ready for your venue to review.";
  }
}
