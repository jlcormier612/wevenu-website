"use server";

import { revalidatePath } from "next/cache";

import {
  cancelEnrollment_, createSequence, deleteSequence_, enrollRelationshipManually,
  searchRelationships, setSequenceStatus_, updateSequence_,
} from "@/lib/message-sequences/service";
import type {
  CreateSequenceResult, EnrollResult, MessageSequenceInput, SequenceActionResult,
} from "@/lib/message-sequences/types";

export async function createSeriesAction(input: MessageSequenceInput): Promise<CreateSequenceResult> {
  const result = await createSequence(input);
  if (result.ok) revalidatePath("/communication/series");
  return result;
}

export async function updateSeriesAction(id: string, input: MessageSequenceInput): Promise<SequenceActionResult> {
  const result = await updateSequence_(id, input);
  if (result.ok) revalidatePath("/communication/series");
  return result;
}

export async function deleteSeriesAction(id: string): Promise<SequenceActionResult> {
  const result = await deleteSequence_(id);
  if (result.ok) revalidatePath("/communication/series");
  return result;
}

export async function setSeriesStatusAction(id: string, status: "active" | "paused"): Promise<SequenceActionResult> {
  const result = await setSequenceStatus_(id, status);
  if (result.ok) revalidatePath("/communication/series");
  return result;
}

export async function searchRelationshipsAction(query: string): Promise<{ id: string; displayName: string }[]> {
  return searchRelationships(query);
}

export async function enrollRelationshipAction(sequenceId: string, relationshipId: string): Promise<EnrollResult> {
  const result = await enrollRelationshipManually(sequenceId, relationshipId);
  if (result.ok) revalidatePath(`/communication/series/${sequenceId}/edit`);
  return result;
}

export async function cancelEnrollmentAction(sequenceId: string, enrollmentId: string): Promise<SequenceActionResult> {
  const result = await cancelEnrollment_(enrollmentId);
  if (result.ok) revalidatePath(`/communication/series/${sequenceId}/edit`);
  return result;
}
