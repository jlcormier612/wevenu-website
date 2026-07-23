"use server";

import { revalidatePath } from "next/cache";

import {
  startOnboardingEngagement,
  pauseOnboardingEngagement,
  resumeOnboardingEngagement,
  markOnboardingBlocked,
  completeOnboardingEngagement,
  assignOnboardingSpecialist,
  setOnboardingCurrentFocus,
} from "@/lib/hq/onboarding-service";
import { requireAdminUser } from "@/lib/hq/crm-service";
import { recordEngagementEvent } from "@/lib/activation/service";
import { sendEmail } from "@/lib/email/send";
import type { OnboardingActionResult } from "@/lib/hq/onboarding-types";

function revalidate(venueId: string) {
  revalidatePath(`/admin/onboarding/${venueId}`);
  revalidatePath("/admin/onboarding");
}

export async function startOnboardingAction(venueId: string): Promise<OnboardingActionResult> {
  const result = await startOnboardingEngagement(venueId);
  if (result.ok) revalidate(venueId);
  return result;
}

export async function pauseOnboardingAction(venueId: string): Promise<OnboardingActionResult> {
  const result = await pauseOnboardingEngagement(venueId);
  if (result.ok) revalidate(venueId);
  return result;
}

export async function resumeOnboardingAction(venueId: string): Promise<OnboardingActionResult> {
  const result = await resumeOnboardingEngagement(venueId);
  if (result.ok) revalidate(venueId);
  return result;
}

export async function markOnboardingBlockedAction(venueId: string): Promise<OnboardingActionResult> {
  const result = await markOnboardingBlocked(venueId);
  if (result.ok) revalidate(venueId);
  return result;
}

export async function completeOnboardingAction(venueId: string): Promise<OnboardingActionResult> {
  const result = await completeOnboardingEngagement(venueId);
  if (result.ok) revalidate(venueId);
  return result;
}

export async function assignOnboardingToMeAction(venueId: string, hqAdminId: string): Promise<OnboardingActionResult> {
  const result = await assignOnboardingSpecialist(venueId, hqAdminId);
  if (result.ok) revalidate(venueId);
  return result;
}

export async function unassignOnboardingAction(venueId: string): Promise<OnboardingActionResult> {
  const result = await assignOnboardingSpecialist(venueId, null);
  if (result.ok) revalidate(venueId);
  return result;
}

export async function setOnboardingFocusAction(venueId: string, currentFocus: string): Promise<OnboardingActionResult> {
  const result = await setOnboardingCurrentFocus(venueId, currentFocus);
  if (result.ok) revalidate(venueId);
  return result;
}

/**
 * §2.2a step 5 — "Communicate with the venue," scoped narrowly for v1: no
 * bidirectional in-app thread exists between HQ staff and a venue anywhere
 * in this codebase (Conversations is venue↔couple/vendor/lead only,
 * confirmed — building one is a separate messaging-infrastructure project,
 * not a checkbox here). This sends a real outbound email via the same
 * infra every other transactional email in this app already uses, and
 * logs it to the engagement's own activity trail
 * (recordEngagementEvent — the same audit mechanism View-As already
 * writes through) so it shows up in the venue's HQ activity timeline.
 */
export async function sendOnboardingUpdateAction(
  venueId: string, toEmail: string, subject: string, body: string,
): Promise<OnboardingActionResult> {
  const actor = await requireAdminUser();
  if (!actor) return { ok: false, message: "Not signed in as an HQ admin." };
  if (!toEmail.trim() || !subject.trim() || !body.trim()) {
    return { ok: false, message: "Recipient, subject, and message are all required." };
  }
  const result = await sendEmail({ to: toEmail, subject, text: body, html: body.replace(/\n/g, "<br />") });
  if (!result.ok) return { ok: false, message: result.message };
  void recordEngagementEvent({ venueId, eventType: "hq.onboarding_update_sent", actorType: "hq_admin", actorId: actor.userId });
  revalidate(venueId);
  return { ok: true };
}
