"use server";

import { revalidatePath } from "next/cache";

import * as setupHub from "@/lib/setup-hub/service";
import type { LeadCaptureChannelKey } from "@/lib/setup-hub/types";

export async function markChannelConfiguredAction(channel: LeadCaptureChannelKey) {
  const result = await setupHub.markChannelConfigured(channel);
  if (result.ok) revalidatePath("/setup-hub/lead-capture");
  return result;
}

export async function markChannelVerifiedAction(channel: LeadCaptureChannelKey) {
  const result = await setupHub.markChannelVerified(channel);
  if (result.ok) revalidatePath("/setup-hub/lead-capture");
  return result;
}

export async function setLeadCapturePathAction(path: "automated" | "manual_external") {
  const result = await setupHub.setLeadCapturePath(path);
  if (result.ok) {
    revalidatePath("/setup-hub/lead-capture");
    revalidatePath("/setup-hub");
  }
  return result;
}

export async function markStageReviewedAction(
  stage: "your-venue" | "calendar-availability" | "your-offerings" | "client-experience" | "financials",
) {
  const result = await setupHub.markStageReviewed(stage);
  if (result.ok) revalidatePath("/setup-hub");
  return result;
}

export async function setBringYourBusinessManualAction() {
  const result = await setupHub.setBringYourBusinessManual();
  if (result.ok) revalidatePath("/setup-hub");
  return result;
}

export async function setYourTeamSoloAction() {
  const result = await setupHub.setYourTeamSolo();
  if (result.ok) revalidatePath("/setup-hub");
  return result;
}

export async function setReadyToInviteCouplesAction(ready: boolean) {
  const result = await setupHub.setReadyToInviteCouples(ready);
  if (result.ok) {
    revalidatePath("/setup-hub");
    revalidatePath("/dashboard");
  }
  return result;
}
