"use server";

import { revalidatePath } from "next/cache";

import {
  getClientInvitation, inviteClient, resendClientInvitation, revokeClientInvitation,
  revokeClientAccess, getSupportAccessGrants, openSupportAccess,
} from "@/lib/client-auth/service";
import type { ClientAuthResult, ClientInvitation, SupportAccessGrant } from "@/lib/client-auth/types";

export async function getClientInvitationAction(clientId: string): Promise<ClientInvitation | null> {
  return getClientInvitation(clientId);
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
