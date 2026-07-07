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
import { exportVenueData, type ExportResult } from "@/lib/export/service";

export async function exportVenueDataAction(): Promise<ExportResult> {
  return exportVenueData();
}

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

import {
  connectStripeAccount,
  disconnectStripeAccount,
  updateVenueLogo,
} from "@/lib/venue/service";

export async function updateLogoAction(url: string | null): Promise<void> {
  await updateVenueLogo(url);
  revalidatePath("/", "layout");
}

export async function connectStripeAction(accountId: string): Promise<void> {
  await connectStripeAccount(accountId);
  revalidatePath("/settings");
  revalidatePath("/", "layout");
}

export async function disconnectStripeAction(): Promise<void> {
  await disconnectStripeAccount();
  revalidatePath("/settings");
  revalidatePath("/", "layout");
}
