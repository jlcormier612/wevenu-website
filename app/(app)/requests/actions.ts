"use server";

import { revalidatePath } from "next/cache";

import type { RequestClientOption } from "@/lib/requests/client-search";
import {
  assignRequest, createRequest, getRequestHistory, searchRequestClients, setClientActionEnabled, updateRequestStatus,
} from "@/lib/requests/service";
import type {
  RequestActionResult, RequestInput, RequestLifecycleEventRecord, RequestStatus,
} from "@/lib/requests/types";

export async function createRequestAction(
  input: RequestInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const result = await createRequest(input);
  if (result.ok) revalidatePath("/requests");
  return result;
}

export async function updateRequestStatusAction(
  requestId: string, status: RequestStatus,
): Promise<RequestActionResult> {
  const result = await updateRequestStatus(requestId, status);
  if (result.ok) revalidatePath("/requests");
  return result;
}

export async function assignRequestAction(
  requestId: string, staffId: string,
): Promise<RequestActionResult> {
  const result = await assignRequest(requestId, staffId);
  if (result.ok) revalidatePath("/requests");
  return result;
}

export async function getRequestHistoryAction(requestId: string): Promise<RequestLifecycleEventRecord[]> {
  return getRequestHistory(requestId);
}

export async function setClientActionEnabledAction(
  requestId: string, enabled: boolean,
): Promise<RequestActionResult> {
  const result = await setClientActionEnabled(requestId, enabled);
  if (result.ok) revalidatePath(`/requests/${requestId}`);
  return result;
}

export async function searchRequestClientsAction(
  query: string,
): Promise<{ ok: true; results: RequestClientOption[] } | { ok: false; error: string }> {
  try {
    const results = await searchRequestClients(query);
    return { ok: true, results };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not search clients. Try again.";
    return { ok: false, error: message };
  }
}
