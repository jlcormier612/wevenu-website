/**
 * Stage-change message choice.
 *
 * Send schedules every message step of every matching automation.
 * Don't send records those same steps as cancelled for this attempt only.
 * Cancel writes nothing.
 *
 * The only non-message side effect on enrollment is updatePipelineOnEnroll.
 * Both Send and Don't send keep it. Neither choice edits the saved automation.
 */

export const STAGE_CHANGE_SKIP_WINDOW_MS = 15_000;

export type StageChangeMessageChoice = "send" | "skip" | "cancel";

export type StageChangeSequenceEffect = {
  id: string;
  updatePipelineOnEnroll: boolean;
  stepIds: string[];
};

export type StageChangeEffects = {
  writesStage: boolean;
  messageStatus: "scheduled" | "cancelled" | null;
  enrollmentStatus: "active" | "cancelled" | null;
  pipelineAdvanceSequenceIds: string[];
  stepIds: string[];
  mutatesSavedAutomation: false;
};

export function stageChangeEffects(input: {
  choice: StageChangeMessageChoice;
  sequences: readonly StageChangeSequenceEffect[];
}): StageChangeEffects {
  if (input.choice === "cancel") {
    return {
      writesStage: false,
      messageStatus: null,
      enrollmentStatus: null,
      pipelineAdvanceSequenceIds: [],
      stepIds: [],
      mutatesSavedAutomation: false,
    };
  }
  const stepIds = input.sequences.flatMap((sequence) => sequence.stepIds);
  return {
    writesStage: true,
    messageStatus: input.choice === "skip" ? "cancelled" : "scheduled",
    enrollmentStatus: input.choice === "skip" ? "cancelled" : "active",
    pipelineAdvanceSequenceIds: input.sequences
      .filter((sequence) => sequence.updatePipelineOnEnroll)
      .map((sequence) => sequence.id),
    stepIds,
    mutatesSavedAutomation: false,
  };
}

/** Messages are queued only after the stage write succeeds. */
export function queueMessagesAfterStageWrite(stageWriteSucceeded: boolean): boolean {
  return stageWriteSucceeded;
}

/** The sender claims only rows still waiting to send. */
export function isDispatchableScheduledStatus(status: string): boolean {
  return status === "scheduled";
}

export function previewCoversEveryStep(
  previewedStepIds: readonly string[],
  enrolledStepIds: readonly string[],
): boolean {
  if (previewedStepIds.length !== enrolledStepIds.length) return false;
  const previewed = new Set(previewedStepIds);
  return enrolledStepIds.every((id) => previewed.has(id));
}

/**
 * A second Don't send click in this window must not create another
 * cancelled enrollment. A later stage change, after the window, may enroll again.
 */
export function shouldRecordAnotherSkip(
  latest: { status: string; enrolledAtMs: number } | null,
  nowMs: number,
  windowMs = STAGE_CHANGE_SKIP_WINDOW_MS,
): boolean {
  if (!latest || latest.status !== "cancelled") return true;
  return nowMs - latest.enrolledAtMs > windowMs;
}

export function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  if (code === "23505") return true;
  const message = (error as { message?: string }).message ?? "";
  return message.includes("sequence_enrollments_active_unique") || message.includes("duplicate key");
}

export function stageChangeStepTimingLabel(offsetDays: number, index: number): string {
  if (index === 0 && offsetDays <= 0) return "Sends when the stage changes";
  if (offsetDays <= 0) return "Sends with the previous message";
  const days = `${offsetDays} day${offsetDays === 1 ? "" : "s"}`;
  return `Sends ${days} after the previous message`;
}
