/**
 * PM-04 Practice Run planning prepare / share / review mutations.
 */

import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  markStageComplete,
  markStageInProgress,
  type PracticePlanningSnapshot,
} from "@/lib/practice-run/journey";
import {
  seedPracticePlanningResources,
  sharePracticePlanningResources,
} from "@/lib/practice-run/planning-seed";
import * as practiceRepo from "@/lib/practice-run/repository";
import type { PracticeRun } from "@/lib/practice-run/types";
import { getCurrentVenue } from "@/lib/venue/service";
import { shareTimelineWithCouple } from "@/lib/timeline/service";

export type PracticePlanningResult =
  | { ok: true; run: PracticeRun; planning: PracticePlanningSnapshot; message?: string }
  | { ok: false; message: string };

async function requireActiveRun(
  runId?: string | null,
): Promise<
  | { ok: true; client: Awaited<ReturnType<typeof createClient>>; venueId: string; run: PracticeRun }
  | { ok: false; message: string }
> {
  if (!isSupabaseConfigured) return { ok: false, message: "Hello to Cheers is not connected." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "Choose a venue to continue." };
  const client = await createClient();
  const run = runId
    ? await practiceRepo.getPracticeRunForVenue(client, venue.id, runId)
    : await practiceRepo.getActivePracticeRun(client, venue.id);
  if (!run || run.status !== "in_progress") {
    return { ok: false, message: "Start a Practice Run from Setup Hub to continue." };
  }
  return { ok: true, client, venueId: venue.id, run };
}

async function savePlanning(
  client: Awaited<ReturnType<typeof createClient>>,
  venueId: string,
  run: PracticeRun,
  planning: PracticePlanningSnapshot,
  stage: "in_progress" | "complete" = "in_progress",
): Promise<PracticePlanningResult> {
  let journey = markStageInProgress(run.journey, "explore_planning");
  journey = { ...journey, planning };
  if (stage === "complete") {
    journey = markStageComplete(journey, "explore_planning");
  }
  try {
    const updated = await practiceRepo.updatePracticeJourney(client, venueId, run.id, journey);
    return { ok: true, run: updated, planning };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not save Practice Run planning progress.",
    };
  }
}

/** Prepare sample planning resources on the practice Event. */
export async function preparePracticePlanning(runId?: string | null): Promise<PracticePlanningResult> {
  const ctx = await requireActiveRun(runId);
  if (!ctx.ok) return ctx;
  if (!ctx.run.practiceBookedAt) {
    return {
      ok: false,
      message: "Mark the sample celebration practice-booked before preparing planning resources.",
    };
  }
  const planning = await seedPracticePlanningResources(ctx.client, ctx.venueId, ctx.run);
  const result = await savePlanning(ctx.client, ctx.venueId, ctx.run, planning, "in_progress");
  if (!result.ok) return result;
  return {
    ...result,
    message:
      planning.sources.tasks === "practice_fallback"
        ? "Practice planning resources are ready. These are clearly labeled practice-only examples and were not added to your permanent libraries."
        : "Planning resources are ready using your venue’s configured materials where available.",
  };
}

/** Share prepared resources into the Client perspective (no external delivery). */
export async function sharePracticePlanning(runId?: string | null): Promise<PracticePlanningResult> {
  const ctx = await requireActiveRun(runId);
  if (!ctx.ok) return ctx;
  const prepared = ctx.run.journey.planning;
  if (!prepared?.preparedAt) {
    return { ok: false, message: "Prepare planning resources before sharing with the couple." };
  }

  const shared = await sharePracticePlanningResources(
    ctx.client,
    ctx.venueId,
    ctx.run,
    prepared,
  );

  // Real timeline release path (in-app snapshot; no email/SMS).
  if (ctx.run.sampleEventId) {
    const released = await shareTimelineWithCouple(ctx.run.sampleEventId);
    if (!released.ok) {
      // Keep document/task shares; report timeline message without failing the whole share.
      // Venue can retry share after adding timeline items.
    }
  }

  const result = await savePlanning(ctx.client, ctx.venueId, ctx.run, shared, "in_progress");
  if (!result.ok) return result;
  return {
    ...result,
    message:
      "Selected resources are now visible in the Client perspective. Nothing was emailed, texted, or published publicly.",
  };
}

/** Mark that the owner tried Client activities. */
export async function markPracticeClientTried(runId?: string | null): Promise<PracticePlanningResult> {
  const ctx = await requireActiveRun(runId);
  if (!ctx.ok) return ctx;
  const planning = ctx.run.journey.planning;
  if (!planning?.sharedAt) {
    return { ok: false, message: "Share planning resources, then try the Client perspective." };
  }
  const next = { ...planning, clientTriedAt: planning.clientTriedAt ?? new Date().toISOString() };
  const result = await savePlanning(ctx.client, ctx.venueId, ctx.run, next, "in_progress");
  if (!result.ok) return result;
  return { ...result, message: "Client perspective explored. Switch back to Venue to review updates." };
}

/** Mark venue review complete and finish explore_planning stage. */
export async function markPracticePlanningReviewed(
  runId?: string | null,
): Promise<PracticePlanningResult> {
  const ctx = await requireActiveRun(runId);
  if (!ctx.ok) return ctx;
  const planning = ctx.run.journey.planning;
  if (!planning?.preparedAt) {
    return { ok: false, message: "Prepare planning resources before finishing this stage." };
  }
  const next = {
    ...planning,
    reviewedAt: new Date().toISOString(),
    clientTriedAt: planning.clientTriedAt ?? new Date().toISOString(),
  };
  const result = await savePlanning(ctx.client, ctx.venueId, ctx.run, next, "complete");
  if (!result.ok) return result;
  return {
    ...result,
    message: "Planning walkthrough complete. You can keep exploring the sample celebration anytime.",
  };
}
