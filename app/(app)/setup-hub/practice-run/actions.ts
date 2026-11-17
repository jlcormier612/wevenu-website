"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  advancePracticeContractSimulation,
  beginPracticeStage,
  confirmPracticeStageExplored,
  practiceBookCelebration,
  preparePracticeContract,
  savePracticeProposal,
  simulatePracticeClientPackageSelection,
  simulatePracticeProposalDelivery,
} from "@/lib/practice-run/journey-service";
import type { PracticeStageId } from "@/lib/practice-run/journey";
import { sendPracticeVenueMessage } from "@/lib/practice-run/conversation-service";
import {
  markPracticeClientTried,
  markPracticePlanningReviewed,
  preparePracticePlanning,
  sharePracticePlanning,
} from "@/lib/practice-run/planning-service";
import {
  finishPracticeRun,
  resetPracticeRun,
} from "@/lib/practice-run/lifecycle-service";
import { startOrResumePracticeRun } from "@/lib/practice-run/service";

function revalidatePractice(runId: string) {
  revalidatePath("/setup-hub/practice-run");
  revalidatePath(`/setup-hub/practice-run?run=${encodeURIComponent(runId)}`);
  revalidatePath(`/practice-run/${encodeURIComponent(runId)}/client`);
  revalidatePath("/setup-hub/take-a-look");
  revalidatePath("/setup-hub");
}

export async function startOrResumePracticeRunAction(): Promise<void> {
  const result = await startOrResumePracticeRun();
  if (!result.ok) {
    redirect(`/setup-hub/take-a-look?practiceError=${encodeURIComponent(result.message)}`);
  }
  redirect(`/setup-hub/practice-run?run=${encodeURIComponent(result.run.id)}`);
}

export async function beginPracticeStageAction(input: {
  stageId: PracticeStageId;
  runId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await beginPracticeStage(input.stageId, input.runId);
  if (!result.ok) return result;
  revalidatePractice(result.run.id);
  return { ok: true };
}

export async function confirmPracticeStageExploredAction(input: {
  stageId: "meet_inquiry" | "explore_planning";
  runId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await confirmPracticeStageExplored(input.stageId, input.runId);
  if (!result.ok) return result;
  revalidatePractice(result.run.id);
  return { ok: true };
}

export async function savePracticeProposalAction(input: {
  runId: string;
  packageId?: string | null;
}): Promise<{ ok: true; message?: string } | { ok: false; message: string }> {
  const result = await savePracticeProposal(input);
  if (!result.ok) return result;
  revalidatePractice(result.run.id);
  return { ok: true, message: result.message };
}

export async function simulatePracticeProposalDeliveryAction(input: {
  runId: string;
}): Promise<{ ok: true; message?: string } | { ok: false; message: string }> {
  const result = await simulatePracticeProposalDelivery(input.runId);
  if (!result.ok) return result;
  revalidatePractice(result.run.id);
  return { ok: true, message: result.message };
}

export async function simulatePracticeClientSelectionAction(input: {
  runId: string;
}): Promise<{ ok: true; message?: string } | { ok: false; message: string }> {
  const result = await simulatePracticeClientPackageSelection(input.runId);
  if (!result.ok) return result;
  revalidatePractice(result.run.id);
  return { ok: true, message: result.message };
}

export async function preparePracticeContractAction(input: {
  runId: string;
  templateName?: string | null;
  templateSource?: "venue" | "practice_fallback";
}): Promise<{ ok: true; message?: string } | { ok: false; message: string }> {
  const result = await preparePracticeContract(input);
  if (!result.ok) return result;
  revalidatePractice(result.run.id);
  return { ok: true, message: result.message };
}

export async function advancePracticeContractSimulationAction(input: {
  runId: string;
}): Promise<{ ok: true; message?: string } | { ok: false; message: string }> {
  const result = await advancePracticeContractSimulation(input.runId);
  if (!result.ok) return result;
  revalidatePractice(result.run.id);
  return { ok: true, message: result.message };
}

export async function practiceBookCelebrationAction(input: {
  runId: string;
}): Promise<{ ok: true; message?: string } | { ok: false; message: string }> {
  const result = await practiceBookCelebration(input.runId);
  if (!result.ok) return result;
  revalidatePractice(result.run.id);
  return { ok: true, message: result.message };
}

export async function sendPracticeVenueMessageAction(input: {
  runId: string;
  body: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await sendPracticeVenueMessage(input);
  if (!result.ok) return result;
  revalidatePractice(input.runId);
  return { ok: true };
}

export async function preparePracticePlanningAction(input: {
  runId: string;
}): Promise<{ ok: true; message?: string } | { ok: false; message: string }> {
  const result = await preparePracticePlanning(input.runId);
  if (!result.ok) return result;
  revalidatePractice(result.run.id);
  return { ok: true, message: result.message };
}

export async function sharePracticePlanningAction(input: {
  runId: string;
}): Promise<{ ok: true; message?: string } | { ok: false; message: string }> {
  const result = await sharePracticePlanning(input.runId);
  if (!result.ok) return result;
  revalidatePractice(result.run.id);
  return { ok: true, message: result.message };
}

export async function markPracticeClientTriedAction(input: {
  runId: string;
}): Promise<{ ok: true; message?: string } | { ok: false; message: string }> {
  const result = await markPracticeClientTried(input.runId);
  if (!result.ok) return result;
  revalidatePractice(result.run.id);
  return { ok: true, message: result.message };
}

export async function markPracticePlanningReviewedAction(input: {
  runId: string;
}): Promise<{ ok: true; message?: string } | { ok: false; message: string }> {
  const result = await markPracticePlanningReviewed(input.runId);
  if (!result.ok) return result;
  revalidatePractice(result.run.id);
  return { ok: true, message: result.message };
}

export async function finishPracticeRunAction(input: {
  runId: string;
}): Promise<{ ok: true; message?: string } | { ok: false; message: string }> {
  const result = await finishPracticeRun(input.runId);
  if (!result.ok) return result;
  revalidatePractice(result.run.id);
  return { ok: true, message: result.message };
}

export async function finishPracticeRunAndReturnAction(input: {
  runId: string;
}): Promise<void> {
  const result = await finishPracticeRun(input.runId);
  if (!result.ok) {
    redirect(`/setup-hub/practice-run?run=${encodeURIComponent(input.runId)}&lifecycleError=${encodeURIComponent(result.message)}`);
  }
  revalidatePractice(result.run.id);
  redirect("/setup-hub/take-a-look?practiceFinished=1");
}

export async function resetPracticeRunAction(input: {
  runId: string;
}): Promise<{ ok: true; runId: string; message?: string } | { ok: false; message: string }> {
  const result = await resetPracticeRun(input.runId);
  if (!result.ok) return result;
  revalidatePractice(result.previousRunId);
  revalidatePractice(result.run.id);
  return { ok: true, runId: result.run.id, message: result.message };
}

export async function resetPracticeRunAndRedirectAction(formData: FormData): Promise<void> {
  const runId = String(formData.get("runId") ?? "").trim();
  if (!runId) {
    redirect("/setup-hub/take-a-look?practiceError=" + encodeURIComponent("Practice Run not found."));
  }
  const result = await resetPracticeRun(runId);
  if (!result.ok) {
    redirect(`/setup-hub/practice-run?run=${encodeURIComponent(runId)}&lifecycleError=${encodeURIComponent(result.message)}`);
  }
  revalidatePractice(result.previousRunId);
  revalidatePractice(result.run.id);
  redirect(`/setup-hub/practice-run?run=${encodeURIComponent(result.run.id)}&practiceReset=1`);
}
