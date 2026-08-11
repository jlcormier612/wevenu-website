"use server";

import { revalidatePath } from "next/cache";

import {
  createBrochure, deleteBrochure_, duplicateBrochure_, sendBrochureToLead,
  setBrochureArchived_, updateBrochure_,
} from "@/lib/brochures/service";
import type { BrochureActionResult, BrochureInput, CreateBrochureResult } from "@/lib/brochures/types";

function revalidateLibrary(id?: string) {
  revalidatePath("/library/brochures");
  revalidatePath("/library");
  if (id) revalidatePath(`/library/brochures/${id}`);
}

export async function createBrochureAction(input: BrochureInput): Promise<CreateBrochureResult> {
  const result = await createBrochure(input);
  if (result.ok) revalidateLibrary();
  return result;
}

export async function updateBrochureAction(id: string, input: BrochureInput): Promise<BrochureActionResult> {
  const result = await updateBrochure_(id, input);
  if (result.ok) revalidateLibrary(id);
  return result;
}

export async function setBrochureArchivedAction(id: string, isArchived: boolean): Promise<BrochureActionResult> {
  const result = await setBrochureArchived_(id, isArchived);
  if (result.ok) revalidateLibrary(id);
  return result;
}

export async function deleteBrochureAction(id: string): Promise<BrochureActionResult> {
  const result = await deleteBrochure_(id);
  if (result.ok) revalidateLibrary();
  return result;
}

export async function duplicateBrochureAction(id: string, newName: string): Promise<CreateBrochureResult> {
  const result = await duplicateBrochure_(id, newName);
  if (result.ok) revalidateLibrary();
  return result;
}

export async function sendBrochureToLeadAction(brochureId: string, leadId: string, customMessage?: string): Promise<BrochureActionResult> {
  const result = await sendBrochureToLead(brochureId, leadId, customMessage);
  if (result.ok) revalidateLibrary(brochureId);
  return result;
}
