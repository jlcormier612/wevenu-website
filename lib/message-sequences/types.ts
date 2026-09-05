/**
 * Automated Series domain types — Communication Platform Phase 3.
 * "sequence" is the internal/engineering term throughout (§3.6) — "Series"
 * is the UI-facing name only, applied at the component layer.
 */
import type { ScheduledMessageChannel } from "@/lib/scheduled-messages/types";

export type SequenceStatus = "active" | "paused";
export type SequenceTriggerType = "lead_created" | "lead_stage_changed" | "tour_completed";
export type SequenceEnrollmentStatus =
  | "active"
  | "completed"
  | "exited_reply"
  | "exited_booking"
  | "exited_lost"
  | "exited_cancelled"
  | "cancelled";

export type MessageSequence = {
  id: string;
  venueId: string;
  name: string;
  status: SequenceStatus;
  triggerType: SequenceTriggerType | null; // null = manual enrollment only
  triggerStage: string | null;             // only meaningful when triggerType === "lead_stage_changed"
  /** When true, successful enrollment may move lead to enrolled_in_sequence (forward-only). Default false. */
  updatePipelineOnEnroll: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SequenceStep = {
  id: string;
  sequenceId: string;
  templateId: string;
  channel: ScheduledMessageChannel;
  sortOrder: number;
  offsetDays: number; // delay from the previous step's send time, or from enrollment for the first step
  createdAt: string;
};

export type SequenceStepInput = {
  templateId: string;
  channel: ScheduledMessageChannel;
  offsetDays: number;
};

export type MessageSequenceWithSteps = MessageSequence & { steps: SequenceStep[] };

export type MessageSequenceInput = {
  name: string;
  triggerType: SequenceTriggerType | null;
  triggerStage: string | null;
  /** Default false — Move lead to Enrolled in Sequence/Workflow when enrolled. */
  updatePipelineOnEnroll?: boolean;
  steps: SequenceStepInput[];
};

export type SequenceEnrollment = {
  id: string;
  venueId: string;
  sequenceId: string;
  sequenceName: string;
  relationshipId: string;
  relationshipName: string;
  status: SequenceEnrollmentStatus;
  enrolledAt: string;
  exitedAt: string | null;
  /** Set while this one person is paused; status stays active. */
  pausedAt: string | null;
  /** Progress from scheduled_messages linked to this enrollment (when loaded). */
  stepsTotal?: number;
  stepsSent?: number;
  nextScheduledFor?: string | null;
  /** Other active automations this person is in (when loaded for visibility). */
  otherActiveAutomations?: string[];
};

/** List row with optional active-participant count for venue-facing overview. */
export type MessageSequenceListItem = MessageSequence & {
  activeParticipantCount: number;
};

export type SequenceErrors = Record<string, string>;

export type SequenceActionResult =
  | { ok: true }
  | { ok: false; message?: string };

export type CreateSequenceResult =
  | { ok: true; sequenceId: string }
  | { ok: false; errors?: SequenceErrors; message?: string };

export type EnrollResult =
  | { ok: true; enrollmentId: string }
  | { ok: false; message?: string };
