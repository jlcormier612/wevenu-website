/**
 * Program 3 — Sales & Customer Success types.
 * Workflows, communication library, sequences, and pipeline helpers.
 */

import type { PipelineStatus, RelationshipStatus } from "@/lib/types";

import type { ScheduleMode } from "./schedule";

export type { ScheduleMode } from "./schedule";

export type WorkflowTrigger =
  | { type: "manual" }
  | { type: "status_enter"; status: PipelineStatus }
  | { type: "status_leave"; status: PipelineStatus };

export type WorkflowStepType =
  | "delay"
  | "wait_condition"
  | "timed_send"
  | "send_email"
  | "internal_reminder"
  | "create_task"
  | "assign_owner"
  | "notify_team"
  | "pause"
  | "exit";

export type WorkflowStep = {
  id: string;
  type: WorkflowStepType;
  label: string;
  /** Delay in hours before this step runs (after previous completes). */
  delayHours?: number;
  /** relative (default) or absolute calendar send. */
  scheduleMode?: ScheduleMode;
  /** Wall-clock datetime for absolute schedule (local in `timezone`). */
  absoluteAt?: string;
  /** IANA timezone for absoluteAt (default America/New_York). */
  timezone?: string;
  /** Absolute ISO time for timed_send (legacy; prefer scheduleMode + absoluteAt). */
  runAt?: string;
  /** Template id for send_email / timed_send. */
  templateId?: string;
  /** Sequence id — expands to ordered email steps when enrolled. */
  sequenceId?: string;
  /** Wait until relationship reaches this status. */
  waitUntilStatus?: PipelineStatus;
  /** Internal reminder / notify copy. */
  message?: string;
  /** Task title for create_task. */
  taskTitle?: string;
  taskPriority?: "low" | "medium" | "high";
  /** Team member id for assign_owner / notify_team. */
  teamMemberId?: string;
  /** Exit reason logged when type=exit. */
  exitReason?: string;
};

export type Workflow = {
  id: string;
  name: string;
  description: string;
  active: boolean;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
  createdAt: string;
  updatedAt: string;
};

export type WorkflowRunStatus = "active" | "paused" | "completed" | "exited" | "failed";

export type WorkflowRunStepStatus =
  | "pending"
  | "scheduled"
  | "waiting"
  | "running"
  | "completed"
  | "skipped"
  | "failed";

export type WorkflowRunStep = {
  id: string;
  stepId: string;
  type: WorkflowStepType;
  label: string;
  status: WorkflowRunStepStatus;
  scheduledAt?: string;
  completedAt?: string;
  resultNote?: string;
  templateId?: string;
};

export type WorkflowRun = {
  id: string;
  workflowId: string;
  workflowName: string;
  relationshipId: string;
  status: WorkflowRunStatus;
  currentStepIndex: number;
  steps: WorkflowRunStep[];
  enrolledAt: string;
  updatedAt: string;
  pausedAt?: string;
  completedAt?: string;
  exitReason?: string;
  trigger: "manual" | "status_enter" | "status_leave";
};

export type TemplateApproval = "draft" | "approved";
export type TemplatePublishStatus = "draft" | "published";

export type TemplateVersion = {
  id: string;
  version: number;
  subject: string;
  body: string;
  createdAt: string;
  note?: string;
};

export type Template = {
  id: string;
  name: string;
  categoryId: string;
  subject: string;
  body: string;
  variables: string[];
  approval: TemplateApproval;
  publishStatus: TemplatePublishStatus;
  versions: TemplateVersion[];
  /** Performance stubs */
  sentCount: number;
  openCount: number;
  createdAt: string;
  updatedAt: string;
};

/** Who a sequence is meant for — enforced at enroll time. */
export type SequenceTargeting = "prospects" | "customers" | "any";

export type SequenceStep = {
  id: string;
  templateId: string;
  /** Relative delay in hours after previous send (or enrollment for step 0). */
  delayHours: number;
  /** relative (default) waits N hours; absolute fires at absoluteAt in timezone. */
  scheduleMode?: ScheduleMode;
  /** Local datetime string for absolute mode, e.g. 2026-08-01T09:00 */
  absoluteAt?: string;
  /** IANA timezone for this step (falls back to sequence.timezone). */
  timezone?: string;
  label?: string;
};

export type Sequence = {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  steps: SequenceStep[];
  approval: TemplateApproval;
  /** Prospect nurture vs customer check-in targeting. */
  targeting: SequenceTargeting;
  /** Default IANA timezone for absolute steps. */
  timezone: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SequenceEnrollmentStatus =
  | "active"
  | "paused"
  | "completed"
  | "exited"
  | "failed";

export type SequenceEnrollmentStepStatus =
  | "pending"
  | "scheduled"
  | "running"
  | "completed"
  | "skipped"
  | "failed";

export type SequenceEnrollmentStep = {
  id: string;
  sequenceStepId: string;
  templateId: string;
  label: string;
  status: SequenceEnrollmentStepStatus;
  scheduleMode: ScheduleMode;
  /** UTC ISO — tick sends when scheduledFor <= now. */
  scheduledFor?: string;
  delayHours?: number;
  absoluteAt?: string;
  timezone?: string;
  completedAt?: string;
  resultNote?: string;
};

export type SequenceEnrollment = {
  id: string;
  sequenceId: string;
  sequenceName: string;
  relationshipId: string;
  status: SequenceEnrollmentStatus;
  currentStepIndex: number;
  steps: SequenceEnrollmentStep[];
  timezone: string;
  enrolledAt: string;
  updatedAt: string;
  pausedAt?: string;
  completedAt?: string;
  exitReason?: string;
};

export type TemplateCategory = {
  id: string;
  name: string;
  description?: string;
};

export type BrandingConfig = {
  id: string;
  fromName: string;
  fromEmail: string;
  replyToEmail: string;
  signatureHtml: string;
  updatedAt: string;
};

export type LibraryStore = {
  categories: TemplateCategory[];
  templates: Template[];
  sequences: Sequence[];
  branding: BrandingConfig;
};

export type RelationshipPatch = {
  relationshipId: string;
  status?: RelationshipStatus;
  currentStageLabel?: string;
  assignedTeamMemberId?: string;
  foundingMember?: boolean;
  welcomeBackVerified?:
    | "none"
    | "pending"
    | "verified"
    | "rejected"
    | "expired";
  /** Sales board stage (pre-customer view). */
  salesStage?:
    | "inquiry"
    | "discovery_scheduled"
    | "venue_walkthrough"
    | "proposal_sent"
    | "negotiation"
    | "awaiting_signature"
    | "won"
    | "lost"
    | "nurture";
  /** Customer Success lifecycle stage (post-subscribe view). */
  customerSuccessStage?:
    | "welcome"
    | "onboarding"
    | "implementation"
    | "training"
    | "live"
    | "adoption"
    | "healthy"
    | "expansion"
    | "renewal"
    | "renewed";
  updatedAt: string;
};

export type LocalTimelineEvent = {
  id: string;
  relationshipId: string;
  type: string;
  title: string;
  body?: string;
  occurredAt: string;
  actorId?: string;
  meta?: Record<string, string | number | boolean | null>;
};

export type LocalCommunication = {
  id: string;
  relationshipId: string;
  channel: "email" | "internal_comment";
  subject: string;
  body: string;
  direction: "inbound" | "outbound" | "internal";
  occurredAt: string;
  actorId?: string;
  authorName?: string;
};

export type LocalTask = {
  id: string;
  relationshipId: string;
  title: string;
  description?: string;
  ownerId: string;
  dueDate: string;
  priority: "low" | "medium" | "high";
  status: "open" | "in_progress" | "completed" | "cancelled";
  createdAt: string;
  completedAt?: string;
  meta?: Record<string, string | number | boolean | null>;
};
