"use server";

import { revalidatePath } from "next/cache";

import {
  addClientNote,
  deleteClientNote_,
  updateClientInfo,
  updateClientNote_,
  updateClientStatus_,
} from "@/lib/clients/service";
import type {
  ClientActionResult,
  ClientInput,
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

export async function previewDeleteClientAction(clientId: string) {
  const { previewDeleteClient } = await import("@/lib/records/delete-record");
  return previewDeleteClient(clientId);
}

export async function deleteClientRecordAction(clientId: string) {
  const { deleteClientRecord } = await import("@/lib/records/delete-record");
  const result = await deleteClientRecord(clientId);
  if (result.ok) {
    revalidatePath("/clients");
    revalidatePath("/leads");
    revalidatePath("/reporting");
    revalidatePath("/reporting/sales");
    revalidatePath("/reporting/bookings");
  }
  return result;
}

