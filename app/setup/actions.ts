"use server";

import { revalidatePath } from "next/cache";

import { getCurrentVenue, saveSetupProgress, submitVenueSetup, type SubmitSetupResult } from "@/lib/venue/service";
import { getQuickBooksConnection, getRecentQuickBooksSyncLog, type QuickBooksSyncLogEntry } from "@/lib/quickbooks/service";
import type { QuickBooksConnection } from "@/lib/quickbooks/types";
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
 * Guided Setup §1.2 (2026-07-22) — the wizard's "payments" step needs a
 * real venue row (for Stripe) plus QuickBooks connection/sync-log data,
 * none of which exist in the wizard's own client-side VenueSetupInput
 * state. By the time a venue reaches this step (5 steps after venue-info),
 * saveSetupProgressAction has already persisted a real venue row for the
 * session's own venue — same session-resolution every other step's save
 * already uses, no venue id needs to be threaded through wizard state.
 */
export async function getPaymentsStepDataAction(): Promise<{
  venue: Venue | null;
  quickbooksConnection: QuickBooksConnection | null;
  quickbooksSyncLog: QuickBooksSyncLogEntry[];
}> {
  const [venue, quickbooksConnection, quickbooksSyncLog] = await Promise.all([
    getCurrentVenue(),
    getQuickBooksConnection(),
    getRecentQuickBooksSyncLog(),
  ]);
  return { venue, quickbooksConnection, quickbooksSyncLog };
}
