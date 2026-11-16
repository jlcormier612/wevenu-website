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
  return setBringYourBusinessPathAction("skipped");
}

export async function setBringYourBusinessPathAction(path: "individual" | "skipped") {
  const result = await setupHub.setBringYourBusinessPath(path);
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

export async function markWelcomeExploredAction() {
  const result = await setupHub.markWelcomeExplored();
  if (result.ok) revalidatePath("/setup-hub");
  return result;
}

export async function setExistingBookingsAnswerAction(answer: "yes" | "no") {
  const result = await setupHub.setExistingBookingsAnswer(answer);
  if (result.ok) {
    revalidatePath("/setup-hub");
    revalidatePath("/setup-hub/protect-calendar");
    revalidatePath("/setup-hub/bring-business");
  }
  return result;
}

export async function markBookingRulesReviewedAction() {
  const result = await setupHub.markBookingRulesReviewed();
  if (result.ok) {
    revalidatePath("/setup-hub");
    revalidatePath("/setup-hub/protect-calendar");
  }
  return result;
}

function revalidateMilestone02() {
  revalidatePath("/setup-hub");
  revalidatePath("/setup-hub/make-htc-yours");
  revalidatePath("/setup-hub/make-htc-yours/booking-process");
  revalidatePath("/setup-hub/make-htc-yours/event-experiences");
  revalidatePath("/setup-hub/make-htc-yours/communications");
  revalidatePath("/setup-hub/make-htc-yours/operational-resources");
}

export async function setHostedEventTypesAction(eventTypes: string[]) {
  const result = await setupHub.setHostedEventTypes(eventTypes);
  if (result.ok) revalidateMilestone02();
  return result;
}

export async function confirmEventExperienceReviewAction(eventType: string) {
  const { loadMilestone02Context } = await import("@/lib/setup-hub/phase-b1-load");
  const { canConfirmEventTypeReview } = await import("@/lib/setup-hub/phase-b1-readiness");
  const ctx = await loadMilestone02Context();
  if (!ctx) return { ok: false, error: "No venue found." };
  const gate = canConfirmEventTypeReview({
    eventType,
    hostedEventTypes: ctx.hubState?.hostedEventTypes ?? null,
    assignments: ctx.assignments,
    profiles: ctx.profiles,
  });
  if (!gate.ok) return { ok: false, error: gate.message };
  const result = await setupHub.confirmEventExperienceReview(eventType, {
    profileId: gate.profile.id,
    profileUpdatedAt: gate.profile.updatedAt,
    confirmedAt: new Date().toISOString(),
  });
  if (result.ok) {
    revalidateMilestone02();
    revalidatePath(`/setup-hub/make-htc-yours/event-experiences/${encodeURIComponent(eventType)}`);
  }
  return result;
}

export async function markBookingProcessReviewedAction() {
  const { loadMilestone02Context } = await import("@/lib/setup-hub/phase-b1-load");
  const { canConfirmBookingProcess } = await import("@/lib/setup-hub/phase-b1-readiness");
  const ctx = await loadMilestone02Context();
  if (!ctx) return { ok: false, error: "No venue found." };
  if (!canConfirmBookingProcess(ctx.packages)) {
    return {
      ok: false,
      error: "Price or archive every active package before marking this ready. Unpriced starters are not ready to offer.",
    };
  }
  const result = await setupHub.markBookingProcessReviewed();
  if (result.ok) revalidateMilestone02();
  return result;
}

export async function markCommunicationsReviewedAction() {
  const result = await setupHub.markCommunicationsReviewed();
  if (result.ok) revalidateMilestone02();
  return result;
}

export async function markOperationalResourcesReviewedAction(
  choices: Record<string, "using" | "not_using">,
) {
  const result = await setupHub.markOperationalResourcesReviewed(choices);
  if (result.ok) revalidateMilestone02();
  return result;
}
