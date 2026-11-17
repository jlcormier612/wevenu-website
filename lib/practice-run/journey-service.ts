/**
 * PM-02 Practice Run journey mutations.
 * All writes validate venue ownership server-side via practice_runs.venue_id.
 */

import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getPackagesWithItems } from "@/lib/packages/service";
import {
  PRACTICE_FALLBACK_CONTRACT_TEMPLATE,
  PRACTICE_FALLBACK_PACKAGE,
  firstIncompleteStage,
  markStageComplete,
  markStageInProgress,
  nextContractSimStatus,
  type PracticeContractSimStatus,
  type PracticeJourney,
  type PracticeStageId,
} from "@/lib/practice-run/journey";
import * as practiceRepo from "@/lib/practice-run/repository";
import type { PracticeRun } from "@/lib/practice-run/types";
import { getCurrentVenue } from "@/lib/venue/service";

export type PracticeJourneyResult =
  | { ok: true; run: PracticeRun; message?: string }
  | { ok: false; message: string };

async function requireActiveRun(runId?: string | null): Promise<
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

async function saveJourney(
  client: Awaited<ReturnType<typeof createClient>>,
  venueId: string,
  runId: string,
  journey: PracticeJourney,
  extras?: { practiceBookedAt?: string | null },
): Promise<PracticeJourneyResult> {
  try {
    const updated = await practiceRepo.updatePracticeJourney(client, venueId, runId, journey, extras);
    return { ok: true, run: updated };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not save Practice Run progress.",
    };
  }
}

export async function beginPracticeStage(
  stageId: PracticeStageId,
  runId?: string | null,
): Promise<PracticeJourneyResult> {
  const ctx = await requireActiveRun(runId);
  if (!ctx.ok) return ctx;
  const journey = markStageInProgress(ctx.run.journey, stageId);
  return saveJourney(ctx.client, ctx.venueId, ctx.run.id, journey);
}

export async function confirmPracticeStageExplored(
  stageId: "meet_inquiry" | "explore_planning",
  runId?: string | null,
): Promise<PracticeJourneyResult> {
  const ctx = await requireActiveRun(runId);
  if (!ctx.ok) return ctx;
  const journey = markStageComplete(markStageInProgress(ctx.run.journey, stageId), stageId);
  return saveJourney(ctx.client, ctx.venueId, ctx.run.id, journey);
}

export async function savePracticeProposal(input: {
  runId?: string | null;
  packageId?: string | null;
}): Promise<PracticeJourneyResult> {
  const ctx = await requireActiveRun(input.runId);
  if (!ctx.ok) return ctx;

  const packages = await getPackagesWithItems(true);
  const chosen =
    (input.packageId
      ? packages.find((p) => p.id === input.packageId)
      : packages[0]) ?? null;

  const now = new Date().toISOString();
  let journey = markStageInProgress(ctx.run.journey, "prepare_proposal");

  if (chosen) {
    const total = chosen.basePrice ?? 0;
    journey = {
      ...journey,
      proposal: {
        packageId: chosen.id,
        packageName: chosen.name,
        packageSource: "venue",
        totalAmount: total,
        depositAmount: Math.round(total * 0.2),
        includedItems: chosen.items.map((item) => ({
          description: item.description || "Included item",
          quantity: Number(item.quantity ?? 1),
          unit: item.unit ?? null,
        })),
        savedAt: now,
        simulatedDeliveryAt: journey.proposal?.simulatedDeliveryAt ?? null,
        clientSelectionSimulatedAt: journey.proposal?.clientSelectionSimulatedAt ?? null,
      },
    };
  } else {
    journey = {
      ...journey,
      proposal: {
        packageId: PRACTICE_FALLBACK_PACKAGE.id,
        packageName: PRACTICE_FALLBACK_PACKAGE.name,
        packageSource: "practice_fallback",
        totalAmount: PRACTICE_FALLBACK_PACKAGE.totalAmount,
        depositAmount: PRACTICE_FALLBACK_PACKAGE.depositAmount,
        includedItems: [...PRACTICE_FALLBACK_PACKAGE.includedItems],
        savedAt: now,
        simulatedDeliveryAt: journey.proposal?.simulatedDeliveryAt ?? null,
        clientSelectionSimulatedAt: journey.proposal?.clientSelectionSimulatedAt ?? null,
      },
    };
  }

  if (
    journey.proposal?.savedAt
    && journey.proposal.clientSelectionSimulatedAt
  ) {
    journey = markStageComplete(journey, "prepare_proposal");
  }

  const result = await saveJourney(ctx.client, ctx.venueId, ctx.run.id, journey);
  if (!result.ok) return result;
  return {
    ...result,
    message:
      journey.proposal?.packageSource === "practice_fallback"
        ? "Saved a practice-only example package. It was not added to your permanent package library."
        : "Sample proposal saved.",
  };
}

export async function simulatePracticeProposalDelivery(
  runId?: string | null,
): Promise<PracticeJourneyResult> {
  const ctx = await requireActiveRun(runId);
  if (!ctx.ok) return ctx;
  if (!ctx.run.journey.proposal) {
    return { ok: false, message: "Save a sample proposal before simulating delivery." };
  }
  const now = new Date().toISOString();
  const journey: PracticeJourney = {
    ...markStageInProgress(ctx.run.journey, "prepare_proposal"),
    proposal: {
      ...ctx.run.journey.proposal,
      simulatedDeliveryAt: now,
    },
  };
  const result = await saveJourney(ctx.client, ctx.venueId, ctx.run.id, journey);
  if (!result.ok) return result;
  return {
    ...result,
    message:
      "Proposal ready for Maya & Jordan. This is what sending a proposal looks like. In Practice Run, nothing was delivered to a real person.",
  };
}

export async function simulatePracticeClientPackageSelection(
  runId?: string | null,
): Promise<PracticeJourneyResult> {
  const ctx = await requireActiveRun(runId);
  if (!ctx.ok) return ctx;
  if (!ctx.run.journey.proposal) {
    return { ok: false, message: "Save a sample proposal before simulating client selection." };
  }
  const now = new Date().toISOString();
  let journey: PracticeJourney = {
    ...markStageInProgress(ctx.run.journey, "prepare_proposal"),
    proposal: {
      ...ctx.run.journey.proposal,
      clientSelectionSimulatedAt: now,
      simulatedDeliveryAt: ctx.run.journey.proposal.simulatedDeliveryAt ?? now,
    },
  };
  journey = markStageComplete(journey, "prepare_proposal");
  const result = await saveJourney(ctx.client, ctx.venueId, ctx.run.id, journey);
  if (!result.ok) return result;
  return {
    ...result,
    message:
      "Simulated client selection recorded. This is a temporary Practice Run control — the real client portal arrives in the next milestone.",
  };
}

export async function preparePracticeContract(input: {
  runId?: string | null;
  templateName?: string | null;
  templateSource?: "venue" | "practice_fallback";
}): Promise<PracticeJourneyResult> {
  const ctx = await requireActiveRun(input.runId);
  if (!ctx.ok) return ctx;
  const now = new Date().toISOString();
  let journey = markStageInProgress(ctx.run.journey, "create_agreement");
  journey = {
    ...journey,
    contract: {
      templateSource: input.templateSource ?? "practice_fallback",
      templateName:
        input.templateName?.trim()
        || PRACTICE_FALLBACK_CONTRACT_TEMPLATE.name,
      draftedAt: now,
      simulatedStatus: "draft",
      exploredSequenceAt: null,
    },
  };
  const result = await saveJourney(ctx.client, ctx.venueId, ctx.run.id, journey);
  if (!result.ok) return result;
  return {
    ...result,
    message:
      journey.contract?.templateSource === "practice_fallback"
        ? "Drafted a practice-only example agreement. It was not added to your permanent template library."
        : "Sample agreement draft prepared.",
  };
}

export async function advancePracticeContractSimulation(
  runId?: string | null,
): Promise<PracticeJourneyResult> {
  const ctx = await requireActiveRun(runId);
  if (!ctx.ok) return ctx;
  if (!ctx.run.journey.contract) {
    return { ok: false, message: "Prepare a sample contract before simulating signing." };
  }
  const current = ctx.run.journey.contract.simulatedStatus;
  const next = nextContractSimStatus(current);
  if (!next) {
    let journey = {
      ...ctx.run.journey,
      contract: {
        ...ctx.run.journey.contract,
        exploredSequenceAt: ctx.run.journey.contract.exploredSequenceAt ?? new Date().toISOString(),
      },
    };
    journey = markStageComplete(journey, "create_agreement");
    return saveJourney(ctx.client, ctx.venueId, ctx.run.id, journey);
  }

  // Preserve real rule: client signs before venue. Sequence already encodes that.
  const now = new Date().toISOString();
  let journey: PracticeJourney = {
    ...markStageInProgress(ctx.run.journey, "create_agreement"),
    contract: {
      ...ctx.run.journey.contract,
      simulatedStatus: next,
      exploredSequenceAt: next === "fully_executed" ? now : ctx.run.journey.contract.exploredSequenceAt,
    },
  };
  if (next === "fully_executed") {
    journey = markStageComplete(journey, "create_agreement");
  }
  const result = await saveJourney(ctx.client, ctx.venueId, ctx.run.id, journey);
  if (!result.ok) return result;
  return {
    ...result,
    message: `Simulated: ${labelForSim(next)}. No genuine electronic signature was created.`,
  };
}

function labelForSim(status: PracticeContractSimStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "sent_to_client":
      return "Sent to Client";
    case "client_signed":
      return "Client Signed";
    case "awaiting_venue_signature":
      return "Awaiting Venue Signature";
    case "fully_executed":
      return "Fully Executed";
  }
}

/**
 * Practice-booked: stamps practice_runs.practice_booked_at only.
 * Never calls bookClient, never sets events.booked_at, never occupies calendar.
 */
export async function practiceBookCelebration(
  runId?: string | null,
): Promise<PracticeJourneyResult> {
  const ctx = await requireActiveRun(runId);
  if (!ctx.ok) return ctx;
  const now = new Date().toISOString();
  let journey = markStageInProgress(ctx.run.journey, "get_ready");
  journey = markStageComplete(journey, "get_ready");
  const result = await saveJourney(ctx.client, ctx.venueId, ctx.run.id, journey, {
    practiceBookedAt: ctx.run.practiceBookedAt ?? now,
  });
  if (!result.ok) return result;
  return {
    ...result,
    message:
      "Sample celebration is practice-booked. It does not occupy your calendar, change booked counts, or create invoices.",
  };
}

export async function resumePracticeStageId(run: PracticeRun): PracticeStageId {
  return firstIncompleteStage(run.journey) ?? "explore_planning";
}
