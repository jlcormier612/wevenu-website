/**
 * Phase 5 communications review — presentation only for automations.
 *
 * Reads existing invitation records and venue-authored Automations.
 * Does not send, enroll, schedule, or create a welcome message on its own.
 * The Communications panel may offer Invite client via the existing
 * authorized invite path — that path is user-initiated, never on page load.
 * Booked-stage Automations are listed when configured; they are not created
 * or changed here.
 */

import type { ClientInvitationStatus } from "@/lib/client-auth/types";

/** Same rule as shouldSendClientInvitation in client-auth/service — kept local to avoid importing server modules into this presentation helper. */
function canSendInvitation(
  existing: { status: ClientInvitationStatus } | null,
): boolean {
  if (!existing) return true;
  return existing.status !== "pending" && existing.status !== "accepted";
}

export type CommunicationsReviewInvitation = {
  status: ClientInvitationStatus;
};

export type CommunicationsReviewAutomation = {
  id: string;
  name: string;
  status: "active" | "paused";
  triggerType: string | null;
  triggerStage: string | null;
};

export type CommunicationsReviewRow = {
  key: "invitation" | "automated_messages";
  label: string;
  detail: string;
  onFile: boolean;
  needsAttention: boolean;
  href: string;
  actionLabel: string;
};

/** Invite controls for the Client invitation row (user-initiated only). */
export type CommunicationsInviteControl = {
  canInvite: boolean;
  clientId: string;
  email: string | null;
  coupleName: string;
  /** Shown when canInvite is false and an invite is not already on file. */
  disabledReason: string | null;
};

export type CommunicationsReviewModel = {
  heading: string;
  summary: string;
  reviewNote: string;
  rows: CommunicationsReviewRow[];
  invite: CommunicationsInviteControl;
};

export const COMMUNICATIONS_REVIEW_NOTE =
  "Opening this page does not send a message. Use Invite client when you're ready, or the client is invited when you release Client Planning if an email is on file.";

export function isActiveBookedStageAutomation(automation: CommunicationsReviewAutomation): boolean {
  return (
    automation.status === "active" &&
    automation.triggerType === "lead_stage_changed" &&
    automation.triggerStage === "booked"
  );
}

export function invitationDetail(
  invitation: CommunicationsReviewInvitation | null,
  clientHasEmail: boolean,
): string {
  if (!invitation) {
    return clientHasEmail
      ? "Not sent — invite them when you're ready, or they'll be invited when you release Client Planning."
      : "Not sent — no client email on file";
  }
  if (invitation.status === "accepted") return "Client accepted their invitation";
  if (invitation.status === "revoked") {
    return clientHasEmail
      ? "Invitation revoked — you can send a new invitation."
      : "Invitation revoked — no client email on file";
  }
  return "Invitation sent";
}

export function invitationInviteControl(input: {
  clientId: string;
  invitation: CommunicationsReviewInvitation | null;
  clientHasEmail: boolean;
  email: string | null;
  coupleName: string;
}): CommunicationsInviteControl {
  const canInvite =
    Boolean(input.email?.trim())
    && canSendInvitation(input.invitation);
  return {
    canInvite,
    clientId: input.clientId,
    email: input.email?.trim() || null,
    coupleName: input.coupleName,
    disabledReason: canInvite
      ? null
      : !input.email?.trim()
        ? "No client email on file"
        : input.invitation?.status === "pending" || input.invitation?.status === "accepted"
          ? null
          : "Invitation cannot be sent right now",
  };
}

function invitationRow(
  clientId: string,
  invitation: CommunicationsReviewInvitation | null,
  clientHasEmail: boolean,
): CommunicationsReviewRow {
  const detail = invitationDetail(invitation, clientHasEmail);
  const needsAttention =
    (!invitation && !clientHasEmail) || invitation?.status === "revoked";
  return {
    key: "invitation",
    label: "Client invitation",
    detail,
    onFile: invitation?.status === "pending" || invitation?.status === "accepted",
    needsAttention,
    href: `/clients/${clientId}`,
    actionLabel: "View Client",
  };
}

function automatedMessagesRow(
  automations: CommunicationsReviewAutomation[],
  activeEnrollmentSequenceIds: readonly string[],
): CommunicationsReviewRow {
  const booked = automations.filter(isActiveBookedStageAutomation);
  const href =
    booked.length === 1 ? `/communication/series/${booked[0].id}/edit` : "/communication/series";
  const started = booked.some((a) => activeEnrollmentSequenceIds.includes(a.id));

  if (booked.length === 0) {
    return {
      key: "automated_messages",
      label: "Automated messages",
      detail: "Nothing is scheduled to send automatically when Booked.",
      onFile: false,
      needsAttention: false,
      href: "/communication/series",
      actionLabel: "Review",
    };
  }

  const plan =
    booked.length === 1
      ? booked[0].name.trim()
        ? `${booked[0].name} is set to start when Booked.`
        : "1 message plan is set to start when Booked."
      : `${booked.length} message plans are set to start when Booked.`;
  const detail = started ? `${plan} Messages for this client have already started.` : plan;

  return {
    key: "automated_messages",
    label: "Automated messages",
    detail,
    onFile: true,
    needsAttention: false,
    href,
    actionLabel: booked.length === 1 ? "Edit" : "Review",
  };
}

function summarize(rows: CommunicationsReviewRow[]): string {
  const invitation = rows.find((r) => r.key === "invitation");
  const automated = rows.find((r) => r.key === "automated_messages");
  return [invitation?.detail, automated?.detail].filter(Boolean).join(" ");
}

export function buildCommunicationsReview(input: {
  clientId: string;
  invitation: CommunicationsReviewInvitation | null;
  clientHasEmail: boolean;
  email?: string | null;
  coupleName?: string;
  automations: CommunicationsReviewAutomation[];
  activeEnrollmentSequenceIds?: readonly string[];
}): CommunicationsReviewModel {
  const rows = [
    invitationRow(input.clientId, input.invitation, input.clientHasEmail),
    automatedMessagesRow(input.automations, input.activeEnrollmentSequenceIds ?? []),
  ];
  return {
    heading: "Communications",
    summary: summarize(rows),
    reviewNote: COMMUNICATIONS_REVIEW_NOTE,
    rows,
    invite: invitationInviteControl({
      clientId: input.clientId,
      invitation: input.invitation,
      clientHasEmail: input.clientHasEmail,
      email: input.email ?? null,
      coupleName: input.coupleName ?? "there",
    }),
  };
}
