"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUserRole, getCurrentVenue, getSetupReadyCounts, saveSetupProgress, submitVenueSetup, type SetupReadyCounts, type SubmitSetupResult } from "@/lib/venue/service";
import { getEmailIntakeStatus, type EmailIntakeStatus } from "@/lib/lead-intake/email-status";
import { getInquiryFormSettings } from "@/lib/inquiry-form/service";
import type { InquiryFormSettings } from "@/lib/inquiry-form/types";
import type { Venue, VenueSetupInput } from "@/lib/venue/types";

/**
 * Server action entry point for the Venue Setup wizard. Thin by design — it
 * delegates all validation and persistence to the application service.
 */
export async function submitVenueSetupAction(
  input: VenueSetupInput,
): Promise<SubmitSetupResult> {
  const result = await submitVenueSetup(input);
  if (result.ok) {
    // Ensure the workspace layout re-evaluates venue gating on next navigation.
    revalidatePath("/", "layout");
  }
  return result;
}

/**
 * Guided Setup — fire-and-forget progress save, called after each step so a
 * venue that abandons the wizard mid-flow resumes exactly where they left
 * off rather than starting over. Never validated to "complete" standards
 * and never flips setup_completed to true.
 */
export async function saveSetupProgressAction(
  input: VenueSetupInput,
  lastStep: string,
): Promise<{ ok: boolean }> {
  return saveSetupProgress(input, lastStep);
}

/**
 * Onboarding sequence correction (2026-08-17) — the wizard's "lead-capture"
 * step introduces the existing lead-capture functionality (inquiry form
 * link/embed, email intake) rather than a parallel system. Same
 * session-resolution pattern as the other data-driven wizard steps below;
 * mirrors exactly what app/(app)/settings/page.tsx already passes to
 * WebsiteFormsSection.
 */
export async function getLeadCaptureStepDataAction(): Promise<{
  venue: Venue | null;
  appUrl: string;
  leadEmailAddress: string | null;
  emailIntakeStatus: EmailIntakeStatus | null;
  inquiryFormSettings: InquiryFormSettings | null;
  canEditInquiryForm: boolean;
}> {
  const [venue, emailIntakeStatus, inquiryFormSettings, role] = await Promise.all([
    getCurrentVenue(),
    getEmailIntakeStatus(),
    getInquiryFormSettings(),
    getCurrentUserRole(),
  ]);
  const leadEmailAddress =
    venue && process.env.RESEND_INBOUND_ADDRESS
      ? `leads+${venue.leadEmailKey}@${process.env.RESEND_INBOUND_ADDRESS.replace(/^.*@/, "")}`
      : null;
  return {
    venue,
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    leadEmailAddress,
    emailIntakeStatus,
    inquiryFormSettings,
    canEditInquiryForm: role === "owner" || role === "manager",
  };
}

/**
 * Guided Setup — Bring Your Business / Your Offerings / Your Business Tools /
 * Your People & Business / Ready to Go all need to know, live, what already
 * exists for this venue (whether from an earlier import or hand-entry) so
 * they can say "you already have 4 packages" instead of asking again. Same
 * session-resolution pattern as getLeadCaptureStepDataAction — no venue id
 * threaded through wizard state, since a real venue row exists by now.
 */
export async function getSetupReadyCountsAction(): Promise<SetupReadyCounts | null> {
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return getSetupReadyCounts(venue.id);
}
