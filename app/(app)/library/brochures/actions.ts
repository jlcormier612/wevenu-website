"use server";

import { revalidatePath } from "next/cache";

import {
  createBrochure, deleteBrochure_, deleteBrochurePhoto_, duplicateBrochure_, sendBrochureToLead,
  setBrochureArchived_, updateBrochure_, updateBrochurePhotography_,
} from "@/lib/brochures/service";
import type { BrochureActionResult, BrochureInput, CreateBrochureResult, DeleteBrochurePhotoResult } from "@/lib/brochures/types";

function revalidateLibrary(id?: string) {
  revalidatePath("/library/brochures");
  revalidatePath("/library");
  if (id) {
    revalidatePath(`/library/brochures/${id}`);
    revalidatePath(`/library/brochures/${id}/preview`);
  }
}

export async function createBrochureAction(input: BrochureInput): Promise<CreateBrochureResult> {
  const result = await createBrochure(input);
  if (result.ok) revalidateLibrary();
  return result;
}

export async function updateBrochureAction(id: string, input: BrochureInput): Promise<BrochureActionResult> {
  try {
    const result = await updateBrochure_(id, input);
    if (result.ok) {
      try {
        revalidateLibrary(id);
      } catch {
        // Persistence already succeeded — do not turn a revalidation failure into a failed save.
      }
    }
    return result;
  } catch (err) {
    const message = err instanceof Error && err.message ? err.message : "Could not save brochure.";
    return { ok: false, message };
  }
}

export async function updateBrochurePhotographyAction(
  id: string,
  photoUrls: string[],
  photoLayout: string,
): Promise<BrochureActionResult> {
  try {
    const result = await updateBrochurePhotography_(id, photoUrls, photoLayout);
    if (result.ok) revalidateLibrary(id);
    return result;
  } catch (err) {
    const message = err instanceof Error && err.message ? err.message : "Could not save photos.";
    return { ok: false, message };
  }
}

export async function deleteBrochurePhotoAction(
  brochureId: string,
  url: string,
): Promise<DeleteBrochurePhotoResult> {
  try {
    const result = await deleteBrochurePhoto_(brochureId, url);
    if (result.ok) revalidateLibrary(brochureId);
    return result;
  } catch (err) {
    const message = err instanceof Error && err.message ? err.message : "Could not delete the photo.";
    return { ok: false, message };
  }
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
