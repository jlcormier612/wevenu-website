/**
 * Automated Series domain types — Communication Platform Phase 3.
 * "sequence" is the internal/engineering term throughout (§3.6) — "Series"
 * is the UI-facing name only, applied at the component layer.
 */
import type { ScheduledMessageChannel } from "@/lib/scheduled-messages/types";

export type SequenceStatus = "active" | "paused";
export type SequenceTriggerType = "lead_created" | "lead_stage_changed";
export type SequenceEnrollmentStatus = "active" | "completed" | "exited_reply" | "exited_booking" | "cancelled";

export type MessageSequence = {
  id: string;
  venueId: string;
  name: string;
  status: SequenceStatus;
  triggerType: SequenceTriggerType | null; // null = manual enrollment only
  triggerStage: string | null;             // only meaningful when triggerType === "lead_stage_changed"
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
