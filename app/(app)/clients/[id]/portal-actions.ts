"use server";

import { revalidatePath } from "next/cache";

import {
  getClientInvitation, inviteClient, previewClientInviteEmail, previewResendClientInviteEmail,
  resendClientInvitation, revokeClientInvitation,
  revokeClientAccess, getSupportAccessGrants, openSupportAccess,
} from "@/lib/client-auth/service";
import type { ClientInviteEmailContent } from "@/lib/client-auth/client-invite-email";
import type { ClientAuthResult, ClientInvitation, SupportAccessGrant } from "@/lib/client-auth/types";

export async function getClientInvitationAction(clientId: string): Promise<ClientInvitation | null> {
  return getClientInvitation(clientId);
}

/** Status of the invoice payment link only — never its token. */
export async function getPaymentLinkStatusAction(
  clientId: string,
): Promise<{ sentAt: string; lastOpenedAt: string | null } | null> {
  const { getPortalSessions } = await import("@/lib/portal/service");
  const session = (await getPortalSessions(clientId)).find((s) => s.accessLevel === "financial");
  return session ? { sentAt: session.createdAt, lastOpenedAt: session.lastAccessedAt } : null;
}

/** Preview only — does not insert an invitation or send email. */
export async function previewClientInviteAction(
  email: string,
  coupleName: string,
): Promise<{ ok: true; preview: ClientInviteEmailContent } | { ok: false; error: string }> {
  return previewClientInviteEmail(email, coupleName);
}

/** Preview a resend — does not send. */
export async function previewResendClientInviteAction(
  invitationId: string,
): Promise<{ ok: true; preview: ClientInviteEmailContent } | { ok: false; error: string }> {
  return previewResendClientInviteEmail(invitationId);
}

export async function inviteClientAction(
  clientId: string, email: string, coupleName: string,
): Promise<ClientAuthResult> {
  const result = await inviteClient(clientId, email, coupleName);
  if (result.ok) {
    // Do not revalidate /booked here — a soft refresh remounts the celebration
    // panel and can wipe the in-place "Invitation sent" state before the new
    // invitation row is visible. Client list/detail still refresh.
    revalidatePath(`/clients/${clientId}`);
    revalidatePath("/clients");
  }
  return result;
}

export async function resendClientInvitationAction(
  clientId: string, invitationId: string,
): Promise<ClientAuthResult> {
  const result = await resendClientInvitation(invitationId);
  if (result.ok) {
    revalidatePath(`/clients/${clientId}`);
    revalidatePath("/clients");
  }
  return result;
}

export async function revokeClientInvitationAction(
  clientId: string, invitationId: string,
): Promise<ClientAuthResult> {
  const result = await revokeClientInvitation(invitationId);
  if (result.ok) revalidatePath(`/clients/${clientId}`);
  return result;
}

export async function revokeClientAccessAction(clientId: string): Promise<ClientAuthResult> {
  const result = await revokeClientAccess(clientId);
  if (result.ok) revalidatePath(`/clients/${clientId}`);
  return result;
}

export async function getSupportAccessGrantsAction(clientId: string): Promise<SupportAccessGrant[]> {
  return getSupportAccessGrants(clientId);
}

export async function openSupportAccessAction(
  grantId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  return openSupportAccess(grantId);
}
