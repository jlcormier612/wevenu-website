/**
 * Phase 5 communications review — presentation only.
 *
 * Reads existing invitation records and venue-authored Automations.
 * Does not send, enroll, schedule, or create a welcome message.
 * Invitation copy matches Phase 3 invite-at-release timing.
 * Booked-stage Automations are listed when configured; they are not created
 * or changed here.
 */

import type { ClientInvitationStatus } from "@/lib/client-auth/types";

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

export type CommunicationsReviewModel = {
  heading: string;
  summary: string;
  reviewNote: string;
  rows: CommunicationsReviewRow[];
};

export const COMMUNICATIONS_REVIEW_NOTE =
  "Opening this page does not send a message. The client invitation is sent when you release Client Planning, if an email is on file.";

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
      ? "Not sent — the client will be invited when you release their planning."
      : "Not sent — no client email on file";
  }
  if (invitation.status === "accepted") return "Client accepted their invitation";
  if (invitation.status === "revoked") return "Invitation revoked";
  return "Invitation sent";
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
      detail: "Nothing is scheduled to send automatically after booking.",
      onFile: false,
      needsAttention: false,
      href: "/communication/series",
      actionLabel: "Review",
    };
  }

  const plan =
    booked.length === 1
      ? booked[0].name.trim()
        ? `${booked[0].name} is set to start after booking.`
        : "1 message plan is set to start after booking."
      : `${booked.length} message plans are set to start after booking.`;
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
  };
}
