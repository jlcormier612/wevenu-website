/**
 * Client invitation send, separate from invitation status.
 *
 * pending / accepted / revoked is whether the client can use the link.
 * delivery_status is what we know about the email provider.
 * A pending row with no provider id is not a successful send.
 */
import type { ClientInvitationStatus } from "@/lib/client-auth/types";
import type { SendResult } from "@/lib/email/send";

export type InvitationDeliveryStatus =
  | "sending"
  | "accepted"
  | "delivered"
  | "opened"
  | "clicked"
  | "failed";

export type InvitationDeliveryRow = {
  id: string;
  status: ClientInvitationStatus;
  email: string;
  token: string;
  deliveryStatus: InvitationDeliveryStatus | null;
  providerMessageId: string | null;
};

export type InvitationDeliveryStore = {
  markSending(id: string): Promise<{ error?: string }>;
  saveOutcome(
    id: string,
    patch: {
      deliveryStatus: InvitationDeliveryStatus;
      providerMessageId: string | null;
      deliveryError: string | null;
    },
  ): Promise<{ error?: string }>;
};

export const INVITE_SEND_AMBIGUOUS =
  "The previous invitation send did not finish. It was not sent again.";

export const INVITE_PROVIDER_ID_NOT_SAVED =
  "The email provider accepted the invitation, but the delivery id could not be saved. It was not sent again.";

export const INVITE_EMAIL_NOT_CONFIGURED =
  "Email is not configured, so the invitation was not sent.";

export const INVITE_BOUNCED_USE_RESEND =
  "The invitation email was not delivered. Resend it to try again.";

export function invitationDeliveryFromRow(
  row: Record<string, unknown> | null | undefined,
): { deliveryStatus: InvitationDeliveryStatus | null; providerMessageId: string | null } {
  const raw = row?.delivery_status;
  const deliveryStatus =
    raw === "sending"
    || raw === "accepted"
    || raw === "delivered"
    || raw === "opened"
    || raw === "clicked"
    || raw === "failed"
      ? raw
      : null;
  const provider = row?.provider_message_id;
  return {
    deliveryStatus,
    providerMessageId: typeof provider === "string" && provider.trim() ? provider : null,
  };
}

function providerAccepted(result: SendResult): result is Extract<SendResult, { ok: true }> & { providerId: string } {
  return result.ok && result.method === "resend" && Boolean(result.providerId);
}

function failureMessage(result: SendResult): string {
  if (!result.ok) return result.message;
  if (result.method === "mailto" || result.method === "disabled") return INVITE_EMAIL_NOT_CONFIGURED;
  return INVITE_EMAIL_NOT_CONFIGURED;
}

/**
 * Send one invitation email and persist the provider id.
 * Refuses when a previous attempt is still ambiguous.
 * Invite mode does not send again once a provider id exists.
 * Resend mode sends again only when the caller has explicitly asked.
 */
export async function transmitClientInvitation(args: {
  row: InvitationDeliveryRow;
  mode: "invite" | "resend";
  /**
   * True only for the row just inserted by this attempt.
   * An older pending row with no delivery record is not sent again.
   */
  sendUnrecorded?: boolean;
  store: InvitationDeliveryStore;
  send: () => Promise<SendResult>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { row } = args;
  if (row.status === "accepted") return { ok: true };
  if (row.status !== "pending") {
    return { ok: false, error: "This invitation is no longer pending." };
  }

  const ambiguous = row.deliveryStatus === "sending" && !args.sendUnrecorded;
  if (ambiguous) return { ok: false, error: INVITE_SEND_AMBIGUOUS };

  if (args.mode === "invite" && row.providerMessageId) {
    if (row.deliveryStatus === "failed") return { ok: false, error: INVITE_BOUNCED_USE_RESEND };
    return { ok: true };
  }

  if (args.mode === "invite" && !row.providerMessageId && row.deliveryStatus !== "failed" && !args.sendUnrecorded) {
    return { ok: true };
  }

  const previousStatus = row.deliveryStatus;
  const previousProviderId = row.providerMessageId;
  const marked = await args.store.markSending(row.id);
  if (marked.error) return { ok: false, error: marked.error };

  let result: SendResult;
  try {
    result = await args.send();
  } catch {
    return { ok: false, error: INVITE_SEND_AMBIGUOUS };
  }

  if (!providerAccepted(result)) {
    if (previousProviderId) {
      await args.store.saveOutcome(row.id, {
        deliveryStatus: previousStatus && previousStatus !== "sending" ? previousStatus : "accepted",
        providerMessageId: previousProviderId,
        deliveryError: null,
      });
    } else {
      await args.store.saveOutcome(row.id, {
        deliveryStatus: "failed",
        providerMessageId: null,
        deliveryError: failureMessage(result),
      });
    }
    return { ok: false, error: failureMessage(result) };
  }

  const saved = await args.store.saveOutcome(row.id, {
    deliveryStatus: "accepted",
    providerMessageId: result.providerId,
    deliveryError: null,
  });
  if (saved.error) return { ok: false, error: INVITE_PROVIDER_ID_NOT_SAVED };
  return { ok: true };
}
