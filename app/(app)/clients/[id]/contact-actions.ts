"use server";

import { revalidatePath } from "next/cache";
import {
  createClientContact, createContactPortalSession,
  deleteClientContact, updateClientContact,
  sendContactPortalInvite, revokeContactPortalAccess,
} from "@/lib/contacts/service";
import type { ClientContactInput } from "@/lib/contacts/types";

export async function createContactAction(
  clientId: string, input: ClientContactInput,
): Promise<{ ok: boolean; message?: string }> {
  const result = await createClientContact(clientId, input);
  if (!result) return { ok: false, message: "Could not add contact." };
  revalidatePath(`/clients/${clientId}`);
  return { ok: true };
}

export async function updateContactAction(
  clientId: string, contactId: string, input: Partial<ClientContactInput>,
): Promise<{ ok: boolean; message?: string }> {
  const result = await updateClientContact(contactId, input);
  if (!result) return { ok: false, message: "Could not update contact." };
  revalidatePath(`/clients/${clientId}`);
  return { ok: true };
}

export async function deleteContactAction(
  clientId: string, contactId: string,
): Promise<{ ok: boolean }> {
  await deleteClientContact(contactId);
  revalidatePath(`/clients/${clientId}`);
  return { ok: true };
}

export async function createContactPortalAction(
  clientId: string, contactId: string, label: string,
): Promise<{ ok: boolean; token?: string }> {
  const token = await createContactPortalSession(clientId, contactId, label);
  if (!token) return { ok: false };
  revalidatePath(`/clients/${clientId}`);
  return { ok: true, token };
}

export async function sendContactInviteAction(
  clientId: string,
  contactId: string,
  contact: { firstName: string; email: string; roleLabel?: string | null },
  coupleName: string,
): Promise<{ ok: boolean; portalUrl?: string; message?: string }> {
  const result = await sendContactPortalInvite(clientId, contactId, contact, coupleName);
  if (result.ok) revalidatePath(`/clients/${clientId}`);
  return result;
}

export async function revokeContactPortalAction(
  clientId: string, contactId: string,
): Promise<{ ok: boolean }> {
  await revokeContactPortalAccess(contactId);
  revalidatePath(`/clients/${clientId}`);
  return { ok: true };
}
