/**
 * Sequence enrollment engine — ordered template sends with relative or absolute schedule.
 * Coexists with workflows; shares @shared/email via mail.ts.
 */

import {
  appendTimelineEvent,
  hasLiveRelationshipsSync,
  loadLiveStoreSync,
} from "@shared/relationships";

import { toPipelineStatus } from "@/lib/pipeline";
import type { Relationship } from "@/lib/types";

import { sendLibraryTemplateEmail } from "./mail";
import {
  computeScheduledFor,
  DEFAULT_SEQUENCE_TIMEZONE,
  nowIso,
  type ScheduleMode,
} from "./schedule";
import {
  appendLocalTimeline,
  getSequenceEnrollmentsSync,
  getSequenceSync,
  newId,
  upsertSequenceEnrollment,
} from "./store";
import type {
  Sequence,
  SequenceEnrollment,
  SequenceEnrollmentStep,
  SequenceStep,
  SequenceTargeting,
} from "./types";

/** Pipeline statuses before subscribed — prospect nurture. */
const PROSPECT_STATUSES = new Set([
  "inquiry",
  "walkthrough_requested",
  "walkthrough_scheduled",
  "walkthrough_completed",
  "trial",
]);

/** Subscribed and beyond — customer check-ins. */
const CUSTOMER_STATUSES = new Set([
  "subscribed",
  "onboarding",
  "white_glove_implementation",
  "live",
  "active",
  "reactivated",
  "at_risk",
  "suspended",
  "expansion",
  "referral",
  "renewal",
  "former_customer",
  "active_customer",
  "support",
]);

export function targetingAllows(
  targeting: SequenceTargeting,
  relationship: Relationship,
): boolean {
  if (targeting === "any") return true;
  const status = toPipelineStatus(relationship.status);
  if (targeting === "prospects") return PROSPECT_STATUSES.has(status);
  return CUSTOMER_STATUSES.has(status);
}

export function normalizeSequenceStep(step: SequenceStep): SequenceStep {
  return {
    ...step,
    delayHours: step.delayHours ?? 0,
    scheduleMode: step.scheduleMode ?? "relative",
  };
}

export function normalizeSequence(seq: Sequence): Sequence {
  return {
    ...seq,
    targeting: seq.targeting ?? "any",
    timezone: seq.timezone || DEFAULT_SEQUENCE_TIMEZONE,
    active: seq.active !== false,
    steps: (seq.steps ?? []).map(normalizeSequenceStep),
  };
}

function stepTimezone(step: SequenceStep, sequence: Sequence): string {
  return step.timezone || sequence.timezone || DEFAULT_SEQUENCE_TIMEZONE;
}

function stepMode(step: SequenceStep): ScheduleMode {
  return step.scheduleMode ?? "relative";
}

function buildEnrollmentSteps(
  sequence: Sequence,
  enrolledAt: string,
): SequenceEnrollmentStep[] {
  const steps = sequence.steps.map(normalizeSequenceStep);
  return steps.map((step, index) => {
    const mode = stepMode(step);
    const tz = stepTimezone(step, sequence);
    const base: SequenceEnrollmentStep = {
      id: newId("ses"),
      sequenceStepId: step.id,
      templateId: step.templateId,
      label: step.label || step.templateId,
      status: "pending",
      scheduleMode: mode,
      delayHours: step.delayHours,
      absoluteAt: step.absoluteAt,
      timezone: tz,
    };

    if (index === 0) {
      const scheduledFor = computeScheduledFor({
        scheduleMode: mode,
        delayHours: step.delayHours,
        absoluteAt: step.absoluteAt,
        timezone: tz,
        baseInstant: enrolledAt,
      });
      const due = new Date(scheduledFor).getTime() <= Date.now();
      return {
        ...base,
        scheduledFor,
        status: due ? "pending" : "scheduled",
      };
    }

    // Absolute later steps: precompute calendar time; relative waits for prior completion.
    if (mode === "absolute" && step.absoluteAt) {
      return {
        ...base,
        scheduledFor: computeScheduledFor({
          scheduleMode: "absolute",
          absoluteAt: step.absoluteAt,
          timezone: tz,
          baseInstant: enrolledAt,
        }),
        status: "pending",
      };
    }

    return base;
  });
}

async function logTimeline(
  relationshipId: string,
  title: string,
  body?: string,
  meta?: Record<string, string | number | boolean | null>,
): Promise<void> {
  const event = {
    id: newId("evt"),
    relationshipId,
    type: "status_changed" as const,
    title,
    body,
    occurredAt: nowIso(),
    meta,
  };

  await appendLocalTimeline(event);

  if (hasLiveRelationshipsSync()) {
    const live = loadLiveStoreSync();
    if (live.relationships.some((r) => r.id === relationshipId)) {
      try {
        await appendTimelineEvent(relationshipId, {
          type: "status_changed",
          title,
          body,
          occurredAt: event.occurredAt,
          meta,
        });
      } catch {
        /* local timeline still recorded */
      }
    }
  }
}

function scheduleNextRelative(
  next: SequenceEnrollmentStep,
  previousSentAt: string,
): void {
  if (next.scheduleMode === "absolute" && next.absoluteAt) {
    const scheduledFor = computeScheduledFor({
      scheduleMode: "absolute",
      absoluteAt: next.absoluteAt,
      timezone: next.timezone,
      baseInstant: previousSentAt,
    });
    next.scheduledFor = scheduledFor;
    next.status =
      new Date(scheduledFor).getTime() > Date.now() ? "scheduled" : "pending";
    return;
  }
  const scheduledFor = computeScheduledFor({
    scheduleMode: "relative",
    delayHours: next.delayHours ?? 0,
    timezone: next.timezone,
    baseInstant: previousSentAt,
  });
  next.scheduledFor = scheduledFor;
  next.status =
    (next.delayHours ?? 0) > 0 && new Date(scheduledFor).getTime() > Date.now()
      ? "scheduled"
      : "pending";
}

/**
 * Process due sequence enrollment steps where scheduledFor <= now.
 */
export async function tickSequences(
  getRelationship: (id: string) => Relationship | undefined,
): Promise<{ processed: number; completedSteps: number }> {
  const enrollments = getSequenceEnrollmentsSync().filter((e) => e.status === "active");
  let processed = 0;
  let completedSteps = 0;
  const now = Date.now();

  for (const enrollment of enrollments) {
    const relationship = getRelationship(enrollment.relationshipId);
    if (!relationship) continue;

    let changed = false;
    let idx = enrollment.currentStepIndex;

    while (idx < enrollment.steps.length) {
      const step = enrollment.steps[idx];
      if (step.status === "completed" || step.status === "skipped") {
        idx += 1;
        continue;
      }

      if (!step.scheduledFor) {
        // Relative step not yet scheduled — wait for prior completion path.
        break;
      }

      if (new Date(step.scheduledFor).getTime() > now) {
        break;
      }

      step.status = "running";
      changed = true;
      processed += 1;

      const { subject, delivery } = await sendLibraryTemplateEmail(
        relationship,
        step.templateId,
        "sequence",
      );
      const sentAt = nowIso();
      step.status = delivery === "failed" ? "failed" : "completed";
      step.completedAt = sentAt;
      step.resultNote =
        delivery === "sent"
          ? `Sent: ${subject}`
          : delivery === "failed"
            ? `Failed: ${subject}`
            : `Sent (simulated): ${subject}`;

      if (step.status === "failed") {
        enrollment.status = "failed";
        enrollment.updatedAt = sentAt;
        break;
      }

      completedSteps += 1;
      const next = enrollment.steps[idx + 1];
      if (next && next.status !== "completed" && next.status !== "skipped") {
        scheduleNextRelative(next, sentAt);
      }
      idx += 1;
      enrollment.currentStepIndex = idx;
    }

    if (enrollment.status === "active" && enrollment.currentStepIndex >= enrollment.steps.length) {
      enrollment.status = "completed";
      enrollment.completedAt = nowIso();
      changed = true;
    }

    if (changed) {
      enrollment.updatedAt = nowIso();
      await upsertSequenceEnrollment(enrollment);
    }
  }

  return { processed, completedSteps };
}

export async function enrollSequence(opts: {
  sequenceId: string;
  relationshipId: string;
  getRelationship: (id: string) => Relationship | undefined;
}): Promise<SequenceEnrollment | { error: string }> {
  const raw = getSequenceSync(opts.sequenceId);
  if (!raw) return { error: "Sequence not found" };
  const sequence = normalizeSequence(raw);
  if (!sequence.active) return { error: "Sequence is inactive" };
  if (sequence.steps.length === 0) return { error: "Sequence has no steps" };

  const relationship = opts.getRelationship(opts.relationshipId);
  if (!relationship) return { error: "Relationship not found" };

  if (!targetingAllows(sequence.targeting, relationship)) {
    return {
      error:
        sequence.targeting === "prospects"
          ? "This sequence is for prospects (before Subscribed)"
          : "This sequence is for customers (Subscribed and beyond)",
    };
  }

  const activeExisting = getSequenceEnrollmentsSync({
    relationshipId: opts.relationshipId,
    sequenceId: opts.sequenceId,
  }).find((e) => e.status === "active" || e.status === "paused");
  if (activeExisting) {
    return { error: "Already enrolled in this sequence" };
  }

  const enrolledAt = nowIso();
  const enrollment: SequenceEnrollment = {
    id: newId("sen"),
    sequenceId: sequence.id,
    sequenceName: sequence.name,
    relationshipId: opts.relationshipId,
    status: "active",
    currentStepIndex: 0,
    steps: buildEnrollmentSteps(sequence, enrolledAt),
    timezone: sequence.timezone || DEFAULT_SEQUENCE_TIMEZONE,
    enrolledAt,
    updatedAt: enrolledAt,
  };

  await upsertSequenceEnrollment(enrollment);
  await logTimeline(
    opts.relationshipId,
    `Enrolled in sequence: ${sequence.name}`,
    `Timezone: ${enrollment.timezone}`,
    { sequenceId: sequence.id, enrollmentId: enrollment.id },
  );

  await tickSequences(opts.getRelationship);
  return getSequenceEnrollmentsSync().find((e) => e.id === enrollment.id) ?? enrollment;
}

export async function pauseSequenceEnrollment(
  enrollmentId: string,
): Promise<SequenceEnrollment | { error: string }> {
  const enrollment = getSequenceEnrollmentsSync().find((e) => e.id === enrollmentId);
  if (!enrollment) return { error: "Enrollment not found" };
  if (enrollment.status !== "active") return { error: "Enrollment is not active" };
  enrollment.status = "paused";
  enrollment.pausedAt = nowIso();
  enrollment.updatedAt = nowIso();
  await upsertSequenceEnrollment(enrollment);
  await logTimeline(
    enrollment.relationshipId,
    `Sequence paused: ${enrollment.sequenceName}`,
    undefined,
    { enrollmentId: enrollment.id },
  );
  return enrollment;
}

export async function resumeSequenceEnrollment(
  enrollmentId: string,
  getRelationship: (id: string) => Relationship | undefined,
): Promise<SequenceEnrollment | { error: string }> {
  const enrollment = getSequenceEnrollmentsSync().find((e) => e.id === enrollmentId);
  if (!enrollment) return { error: "Enrollment not found" };
  if (enrollment.status !== "paused") return { error: "Enrollment is not paused" };
  enrollment.status = "active";
  enrollment.pausedAt = undefined;
  enrollment.updatedAt = nowIso();
  await upsertSequenceEnrollment(enrollment);
  await logTimeline(
    enrollment.relationshipId,
    `Sequence resumed: ${enrollment.sequenceName}`,
    undefined,
    { enrollmentId: enrollment.id },
  );
  await tickSequences(getRelationship);
  return getSequenceEnrollmentsSync().find((e) => e.id === enrollmentId) ?? enrollment;
}

export async function exitSequenceEnrollment(
  enrollmentId: string,
  reason?: string,
): Promise<SequenceEnrollment | { error: string }> {
  const enrollment = getSequenceEnrollmentsSync().find((e) => e.id === enrollmentId);
  if (!enrollment) return { error: "Enrollment not found" };
  if (enrollment.status === "completed" || enrollment.status === "exited") {
    return { error: "Enrollment already finished" };
  }
  enrollment.status = "exited";
  enrollment.exitReason = reason || "Manually exited";
  enrollment.completedAt = nowIso();
  enrollment.updatedAt = nowIso();
  await upsertSequenceEnrollment(enrollment);
  await logTimeline(
    enrollment.relationshipId,
    `Sequence exited: ${enrollment.sequenceName}`,
    enrollment.exitReason,
    { enrollmentId: enrollment.id },
  );
  return enrollment;
}
