"use server";

import { revalidatePath } from "next/cache";

import {
  saveBrandSection,
  saveBusinessHoursSection,
  saveOwnerSection,
  saveVenueInfoSection,
  saveVenueProfileSection,
  type SaveSectionResult,
} from "@/lib/venue/service";
import type { VenueSetupInput } from "@/lib/venue/types";

/** Revalidates the workspace layout so venue name changes appear immediately. */
function revalidateWorkspace() {
  revalidatePath("/", "layout");
}

export async function saveVenueInfoAction(
  input: VenueSetupInput,
): Promise<SaveSectionResult> {
  const result = await saveVenueInfoSection(input);
  if (result.ok) revalidateWorkspace();
  return result;
}

export async function saveVenueProfileAction(
  input: VenueSetupInput,
): Promise<SaveSectionResult> {
  const result = await saveVenueProfileSection(input);
  if (result.ok) revalidateWorkspace();
  return result;
}

export async function saveBusinessHoursAction(
  input: VenueSetupInput,
): Promise<SaveSectionResult> {
  return saveBusinessHoursSection(input);
}

export async function saveBrandAction(
  input: VenueSetupInput,
): Promise<SaveSectionResult> {
  return saveBrandSection(input);
}

export async function saveOwnerAction(
  input: VenueSetupInput,
): Promise<SaveSectionResult> {
  return saveOwnerSection(input);
}
