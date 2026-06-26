"use server";

import { revalidatePath } from "next/cache";

import {
  addClientNote,
  addKeyDate,
  deleteClientNote_,
  deleteKeyDate_,
  updateClientInfo,
  updateClientNote_,
  updateClientStatus_,
} from "@/lib/clients/service";
import type {
  ClientActionResult,
  ClientInput,
  KeyDateInput,
} from "@/lib/clients/types";

function revalidateClient(clientId: string) {
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
}

export async function updateClientStatusAction(clientId: string, status: string): Promise<ClientActionResult> {
  const result = await updateClientStatus_(clientId, status);
  if (result.ok) revalidateClient(clientId);
  return result;
}

export async function updateClientInfoAction(clientId: string, input: ClientInput): Promise<ClientActionResult> {
  const result = await updateClientInfo(clientId, input);
  if (result.ok) revalidateClient(clientId);
  return result;
}

export async function addClientNoteAction(clientId: string, body: string): Promise<ClientActionResult> {
  const result = await addClientNote(clientId, body);
  if (result.ok) revalidateClient(clientId);
  return result;
}

export async function updateClientNoteAction(noteId: string, clientId: string, body: string): Promise<ClientActionResult> {
  const result = await updateClientNote_(noteId, clientId, body);
  if (result.ok) revalidateClient(clientId);
  return result;
}

export async function deleteClientNoteAction(noteId: string): Promise<ClientActionResult> {
  return deleteClientNote_(noteId);
}

export async function addKeyDateAction(clientId: string, input: KeyDateInput): Promise<ClientActionResult> {
  const result = await addKeyDate(clientId, input);
  if (result.ok) revalidateClient(clientId);
  return result;
}

export async function deleteKeyDateAction(kdId: string): Promise<ClientActionResult> {
  return deleteKeyDate_(kdId);
}
