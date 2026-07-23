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
import { setEventCompletedNudgeEnabled } from "@/lib/automation/service";

export async function exportVenueDataAction(): Promise<ExportResult> {
  return exportVenueData();
}

/** RC2, Milestone 4 — the one purpose-built toggle for Event.Completed → review/referral. */
export async function setEventCompletedNudgeEnabledAction(enabled: boolean): Promise<{ ok: boolean; message?: string }> {
  return setEventCompletedNudgeEnabled(enabled);
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
  updateVenueLogo,
  updateVenueHeroImage,
  updateVenueStory,
} from "@/lib/venue/service";
import {
  connectStripeAccount,
  disconnectStripeAccount,
  updateAcceptedPaymentMethods,
} from "@/lib/stripe/service";
import type { StripeActionResult } from "@/lib/stripe/types";
import type { StripePaymentMethodType } from "@/lib/venue/types";
import {
  connectQuickBooksAccount,
  disconnectQuickBooksAccount,
  retryQuickBooksSync,
} from "@/lib/quickbooks/service";
import type { QuickBooksActionResult, QuickBooksEntityType } from "@/lib/quickbooks/types";

export async function updateLogoAction(url: string | null): Promise<void> {
  await updateVenueLogo(url);
  revalidatePath("/", "layout");
}

export async function updateHeroImageAction(url: string | null): Promise<void> {
  await updateVenueHeroImage(url);
  revalidatePath("/", "layout");
}

export async function updateStoryAction(story: string): Promise<void> {
  await updateVenueStory(story);
  revalidatePath("/", "layout");
}

export async function connectStripeAction(accountId: string): Promise<void> {
  await connectStripeAccount(accountId);
  revalidatePath("/settings");
  revalidatePath("/", "layout");
}

export async function disconnectStripeAction(): Promise<StripeActionResult> {
  const result = await disconnectStripeAccount();
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return result;
}

export async function updateAcceptedPaymentMethodsAction(methods: StripePaymentMethodType[]): Promise<StripeActionResult> {
  const result = await updateAcceptedPaymentMethods(methods);
  revalidatePath("/settings");
  return result;
}

export async function connectQuickBooksAction(input: {
  realmId: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
}): Promise<QuickBooksActionResult> {
  const result = await connectQuickBooksAccount(input);
  revalidatePath("/settings");
  return result;
}

export async function disconnectQuickBooksAction(): Promise<QuickBooksActionResult> {
  const result = await disconnectQuickBooksAccount();
  revalidatePath("/settings");
  return result;
}

export async function retryQuickBooksSyncAction(entityType: QuickBooksEntityType, entityId: string): Promise<QuickBooksActionResult> {
  const result = await retryQuickBooksSync(entityType, entityId);
  revalidatePath("/settings");
  return result;
}
