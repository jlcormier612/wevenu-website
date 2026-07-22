import {
  appendTimelineEvent,
  hasLiveRelationshipsSync,
  loadLiveStoreSync,
  setRelationshipStatus,
  stageLabelForStatus,
} from "@shared/relationships";

import { normalizeRelationshipStatus, toPipelineStatus } from "@/lib/pipeline";
import type { PipelineStatus, Relationship, RelationshipStatus } from "@/lib/types";

import { sendLibraryTemplateEmail } from "./mail";
import {
  addHoursIso,
  computeScheduledFor,
  DEFAULT_SEQUENCE_TIMEZONE,
  nowIso,
} from "./schedule";
import { normalizeSequence } from "./sequence-engine";
import {
  appendLocalCommunication,
  appendLocalTask,
  appendLocalTimeline,
  appendRelationshipPatch,
  getSequenceSync,
  getWorkflowRunsSync,
  getWorkflowsSync,
  newId,
  upsertWorkflowRun,
} from "./store";
import type {
  Workflow,
  WorkflowRun,
  WorkflowRunStep,
  WorkflowStep,
} from "./types";
import { interpolate, varsForRelationship } from "./variables";

function addHours(iso: string, hours: number): string {
  return addHoursIso(iso, hours);
}

function resolveStepSchedule(
  step: WorkflowStep,
  baseInstant: string,
): { scheduledAt: string; status: "pending" | "scheduled" } {
  const mode = step.scheduleMode ?? (step.runAt || step.absoluteAt ? "absolute" : "relative");
  const absoluteAt = step.absoluteAt || step.runAt;
  const scheduledAt = computeScheduledFor({
    scheduleMode: mode,
    delayHours: step.delayHours,
    absoluteAt,
    timezone: step.timezone || DEFAULT_SEQUENCE_TIMEZONE,
    baseInstant,
  });
  const future = new Date(scheduledAt).getTime() > Date.now();
  return { scheduledAt, status: future ? "scheduled" : "pending" };
}

/** Expand sequence reference into concrete send_email steps (honors absolute schedule). */
function expandSteps(steps: WorkflowStep[]): WorkflowStep[] {
  const out: WorkflowStep[] = [];
  for (const step of steps) {
    if (step.type === "send_email" && step.sequenceId) {
      const raw = getSequenceSync(step.sequenceId);
      if (!raw) {
        out.push(step);
        continue;
      }
      const seq = normalizeSequence(raw);
      for (const ss of seq.steps) {
        out.push({
          id: `${step.id}__${ss.id}`,
          type: "send_email",
          label: ss.label || `Sequence: ${ss.templateId}`,
          templateId: ss.templateId,
          delayHours: ss.delayHours,
          scheduleMode: ss.scheduleMode ?? "relative",
          absoluteAt: ss.absoluteAt,
          timezone: ss.timezone || seq.timezone,
        });
      }
      continue;
    }
    out.push(step);
  }
  return out;
}

function buildRunSteps(workflow: Workflow, enrolledAt: string): WorkflowRunStep[] {
  const steps = expandSteps(workflow.steps);
  return steps.map((step, index) => {
    if (step.type === "wait_condition") {
      return {
        id: newId("wrs"),
        stepId: step.id,
        type: step.type,
        label: step.label,
        status: "waiting" as const,
        templateId: step.templateId,
      };
    }

    if (index === 0) {
      const { scheduledAt, status } = resolveStepSchedule(step, enrolledAt);
      return {
        id: newId("wrs"),
        stepId: step.id,
        type: step.type,
        label: step.label,
        status,
        scheduledAt,
        templateId: step.templateId,
      };
    }

    const mode = step.scheduleMode ?? (step.absoluteAt || step.runAt ? "absolute" : "relative");
    if (mode === "absolute" && (step.absoluteAt || step.runAt)) {
      const { scheduledAt, status } = resolveStepSchedule(step, enrolledAt);
      return {
        id: newId("wrs"),
        stepId: step.id,
        type: step.type,
        label: step.label,
        status: status === "scheduled" ? "pending" : "pending",
        scheduledAt,
        templateId: step.templateId,
      };
    }

    return {
      id: newId("wrs"),
      stepId: step.id,
      type: step.type,
      label: step.label,
      status: "pending" as const,
      templateId: step.templateId,
    };
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

function findWorkflowStep(workflow: Workflow, stepId: string): WorkflowStep | undefined {
  const expanded = expandSteps(workflow.steps);
  return expanded.find((s) => s.id === stepId) ?? workflow.steps.find((s) => s.id === stepId);
}

async function executeStep(
  run: WorkflowRun,
  runStep: WorkflowRunStep,
  relationship: Relationship,
  workflow: Workflow,
): Promise<{ run: WorkflowRun; pause?: boolean; exit?: boolean }> {
  const def = findWorkflowStep(workflow, runStep.stepId);
  const vars = varsForRelationship(relationship);
  const now = nowIso();

  switch (runStep.type) {
    case "delay": {
      runStep.status = "completed";
      runStep.completedAt = now;
      runStep.resultNote = `Delayed ${def?.delayHours ?? 0}h`;
      break;
    }
    case "wait_condition": {
      const target = def?.waitUntilStatus;
      const current = toPipelineStatus(relationship.status);
      if (target && current === target) {
        runStep.status = "completed";
        runStep.completedAt = now;
        runStep.resultNote = `Condition met: ${target}`;
      } else {
        runStep.status = "waiting";
        runStep.resultNote = `Waiting for status ${target ?? "?"}`;
        return { run };
      }
      break;
    }
    case "timed_send":
    case "send_email": {
      if (!def?.templateId) {
        runStep.status = "failed";
        runStep.resultNote = "No templateId";
        break;
      }
      const { subject, delivery } = await sendLibraryTemplateEmail(
        relationship,
        def.templateId,
        "workflow",
      );
      runStep.status = delivery === "failed" ? "failed" : "completed";
      runStep.completedAt = now;
      runStep.resultNote =
        delivery === "sent"
          ? `Sent: ${subject}`
          : delivery === "failed"
            ? `Failed: ${subject}`
            : `Sent (simulated): ${subject}`;
      break;
    }
    case "internal_reminder": {
      const message = interpolate(def?.message ?? runStep.label, vars);
      await appendLocalTimeline({
        id: newId("evt"),
        relationshipId: relationship.id,
        type: "note_added",
        title: "Internal reminder",
        body: message,
        occurredAt: now,
        meta: { workflowRunId: run.id },
      });
      await appendLocalCommunication({
        id: newId("comm"),
        relationshipId: relationship.id,
        channel: "internal_comment",
        subject: "Internal reminder",
        body: message,
        direction: "internal",
        occurredAt: now,
        authorName: "Workflow",
      });
      runStep.status = "completed";
      runStep.completedAt = now;
      runStep.resultNote = message;
      break;
    }
    case "create_task": {
      const title = interpolate(def?.taskTitle ?? "Follow up", vars);
      await appendLocalTask({
        id: newId("task"),
        relationshipId: relationship.id,
        title,
        ownerId: relationship.assignedTeamMemberId,
        dueDate: addHours(now, 48),
        priority: def?.taskPriority ?? "medium",
        status: "open",
        createdAt: now,
      });
      await appendLocalTimeline({
        id: newId("evt"),
        relationshipId: relationship.id,
        type: "note_added",
        title: `Task created: ${title}`,
        occurredAt: now,
        meta: { workflowRunId: run.id },
      });
      runStep.status = "completed";
      runStep.completedAt = now;
      runStep.resultNote = title;
      break;
    }
    case "assign_owner": {
      const ownerId = def?.teamMemberId;
      if (ownerId) {
        await moveRelationshipStatus(relationship.id, relationship.status, {
          assignedTeamMemberId: ownerId,
          skipTimeline: true,
        });
      }
      runStep.status = "completed";
      runStep.completedAt = now;
      runStep.resultNote = `Assigned ${ownerId ?? "—"}`;
      break;
    }
    case "notify_team": {
      const message = interpolate(def?.message ?? "Team notification", vars);
      await appendLocalTimeline({
        id: newId("evt"),
        relationshipId: relationship.id,
        type: "note_added",
        title: "Team notified",
        body: message,
        occurredAt: now,
        meta: {
          workflowRunId: run.id,
          teamMemberId: def?.teamMemberId ?? null,
        },
      });
      runStep.status = "completed";
      runStep.completedAt = now;
      runStep.resultNote = message;
      break;
    }
    case "pause": {
      runStep.status = "completed";
      runStep.completedAt = now;
      runStep.resultNote = "Run paused by step";
      return { run, pause: true };
    }
    case "exit": {
      runStep.status = "completed";
      runStep.completedAt = now;
      runStep.resultNote = def?.exitReason ?? "Exited";
      return { run, exit: true };
    }
    default: {
      runStep.status = "skipped";
      runStep.completedAt = now;
      runStep.resultNote = "Unknown step type";
    }
  }

  return { run };
}

/**
 * Process due steps for active runs. Call from tick API or page load.
 */
export async function tickWorkflows(getRelationship: (id: string) => Relationship | undefined): Promise<{
  processed: number;
  completedSteps: number;
}> {
  const workflows = getWorkflowsSync();
  const runs = getWorkflowRunsSync().filter((r) => r.status === "active");
  let processed = 0;
  let completedSteps = 0;
  const now = Date.now();

  for (const run of runs) {
    const workflow = workflows.find((w) => w.id === run.workflowId);
    const relationship = getRelationship(run.relationshipId);
    if (!workflow || !relationship) continue;

    let changed = false;
    let idx = run.currentStepIndex;

    while (idx < run.steps.length) {
      const step = run.steps[idx];
      if (step.status === "completed" || step.status === "skipped") {
        idx += 1;
        continue;
      }

      if (step.status === "scheduled" || step.status === "pending") {
        if (step.scheduledAt && new Date(step.scheduledAt).getTime() > now) {
          break;
        }
      }

      if (step.status === "waiting") {
        const def = findWorkflowStep(workflow, step.stepId);
        const target = def?.waitUntilStatus;
        if (!target || toPipelineStatus(relationship.status) !== target) {
          break;
        }
      }

      step.status = "running";
      const result = await executeStep(run, step, relationship, workflow);
      changed = true;
      processed += 1;
      const stepStatus = step.status as WorkflowRunStep["status"];

      if (result.pause) {
        run.status = "paused";
        run.pausedAt = nowIso();
        run.currentStepIndex = idx;
        break;
      }
      if (result.exit) {
        run.status = "exited";
        run.exitReason = step.resultNote;
        run.completedAt = nowIso();
        run.currentStepIndex = idx;
        completedSteps += 1;
        break;
      }

      if (stepStatus === "waiting") {
        run.currentStepIndex = idx;
        break;
      }

      if (stepStatus === "completed" || stepStatus === "skipped") {
        completedSteps += 1;
        // Schedule next step: absolute keeps precomputed time; relative = now + delay
        const next = run.steps[idx + 1];
        if (next && next.status !== "waiting") {
          const nextDef = findWorkflowStep(workflow, next.stepId);
          const mode =
            nextDef?.scheduleMode ??
            (nextDef?.absoluteAt || nextDef?.runAt ? "absolute" : "relative");
          if (mode === "absolute" && (nextDef?.absoluteAt || nextDef?.runAt)) {
            if (!next.scheduledAt) {
              const resolved = resolveStepSchedule(nextDef!, nowIso());
              next.scheduledAt = resolved.scheduledAt;
            }
            next.status =
              new Date(next.scheduledAt).getTime() > Date.now()
                ? "scheduled"
                : "pending";
          } else if (!next.scheduledAt) {
            const delay = nextDef?.delayHours ?? 0;
            next.scheduledAt = addHours(nowIso(), delay);
            next.status = delay > 0 ? "scheduled" : "pending";
          }
        }
        idx += 1;
        run.currentStepIndex = idx;
        continue;
      }

      break;
    }

    if (run.status === "active" && run.currentStepIndex >= run.steps.length) {
      run.status = "completed";
      run.completedAt = nowIso();
      changed = true;
    }

    if (changed) {
      run.updatedAt = nowIso();
      await upsertWorkflowRun(run);
    }
  }

  return { processed, completedSteps };
}

export async function enrollWorkflow(opts: {
  workflowId: string;
  relationshipId: string;
  trigger?: WorkflowRun["trigger"];
  getRelationship: (id: string) => Relationship | undefined;
}): Promise<WorkflowRun | { error: string }> {
  const workflow = getWorkflowsSync().find((w) => w.id === opts.workflowId);
  if (!workflow) return { error: "Workflow not found" };
  if (!workflow.active) return { error: "Workflow is inactive" };

  const relationship = opts.getRelationship(opts.relationshipId);
  if (!relationship) return { error: "Relationship not found" };

  const activeExisting = getWorkflowRunsSync({
    relationshipId: opts.relationshipId,
    workflowId: opts.workflowId,
  }).find((r) => r.status === "active" || r.status === "paused");
  if (activeExisting) {
    return { error: "An active run of this workflow already exists for this relationship" };
  }

  const enrolledAt = nowIso();
  const run: WorkflowRun = {
    id: newId("run"),
    workflowId: workflow.id,
    workflowName: workflow.name,
    relationshipId: opts.relationshipId,
    status: "active",
    currentStepIndex: 0,
    steps: buildRunSteps(workflow, enrolledAt),
    enrolledAt,
    updatedAt: enrolledAt,
    trigger: opts.trigger ?? "manual",
  };

  await upsertWorkflowRun(run);
  await logTimeline(
    opts.relationshipId,
    `Enrolled in workflow: ${workflow.name}`,
    `Trigger: ${run.trigger}`,
    { workflowId: workflow.id, runId: run.id },
  );

  // Immediately process due steps
  await tickWorkflows(opts.getRelationship);
  return getWorkflowRunsSync().find((r) => r.id === run.id) ?? run;
}

export async function pauseWorkflowRun(runId: string): Promise<WorkflowRun | { error: string }> {
  const run = getWorkflowRunsSync().find((r) => r.id === runId);
  if (!run) return { error: "Run not found" };
  if (run.status !== "active") return { error: "Run is not active" };
  run.status = "paused";
  run.pausedAt = nowIso();
  run.updatedAt = nowIso();
  await upsertWorkflowRun(run);
  await logTimeline(run.relationshipId, `Workflow paused: ${run.workflowName}`, undefined, {
    runId: run.id,
  });
  return run;
}

export async function resumeWorkflowRun(
  runId: string,
  getRelationship: (id: string) => Relationship | undefined,
): Promise<WorkflowRun | { error: string }> {
  const run = getWorkflowRunsSync().find((r) => r.id === runId);
  if (!run) return { error: "Run not found" };
  if (run.status !== "paused") return { error: "Run is not paused" };
  run.status = "active";
  run.pausedAt = undefined;
  run.updatedAt = nowIso();
  await upsertWorkflowRun(run);
  await logTimeline(run.relationshipId, `Workflow resumed: ${run.workflowName}`, undefined, {
    runId: run.id,
  });
  await tickWorkflows(getRelationship);
  return getWorkflowRunsSync().find((r) => r.id === runId) ?? run;
}

export async function exitWorkflowRun(
  runId: string,
  reason?: string,
): Promise<WorkflowRun | { error: string }> {
  const run = getWorkflowRunsSync().find((r) => r.id === runId);
  if (!run) return { error: "Run not found" };
  if (run.status === "completed" || run.status === "exited") {
    return { error: "Run already finished" };
  }
  run.status = "exited";
  run.exitReason = reason || "Manually exited";
  run.completedAt = nowIso();
  run.updatedAt = nowIso();
  await upsertWorkflowRun(run);
  await logTimeline(
    run.relationshipId,
    `Workflow exited: ${run.workflowName}`,
    run.exitReason,
    { runId: run.id },
  );
  return run;
}

/** Auto-enroll workflows triggered by entering a pipeline status. */
export async function enrollOnStatusEnter(
  relationshipId: string,
  status: PipelineStatus,
  getRelationship: (id: string) => Relationship | undefined,
): Promise<void> {
  const workflows = getWorkflowsSync().filter(
    (w) =>
      w.active &&
      w.trigger.type === "status_enter" &&
      w.trigger.status === status,
  );
  for (const wf of workflows) {
    await enrollWorkflow({
      workflowId: wf.id,
      relationshipId,
      trigger: "status_enter",
      getRelationship,
    });
  }
}

export async function moveRelationshipStatus(
  relationshipId: string,
  nextStatus: RelationshipStatus,
  opts?: {
    assignedTeamMemberId?: string;
    skipTimeline?: boolean;
    getRelationship?: (id: string) => Relationship | undefined;
  },
): Promise<{ ok: true; status: RelationshipStatus } | { error: string }> {
  const canonical = normalizeRelationshipStatus(nextStatus);
  const label = stageLabelForStatus(canonical);
  const updatedAt = nowIso();

  await appendRelationshipPatch({
    relationshipId,
    status: canonical,
    currentStageLabel: label,
    assignedTeamMemberId: opts?.assignedTeamMemberId,
    updatedAt,
  });

  if (hasLiveRelationshipsSync()) {
    const live = loadLiveStoreSync();
    if (live.relationships.some((r) => r.id === relationshipId)) {
      try {
        await setRelationshipStatus(relationshipId, canonical, {
          currentStageLabel: label,
          assignedTeamMemberId: opts?.assignedTeamMemberId,
        });
      } catch {
        /* patch still applied locally */
      }
    }
  }

  if (!opts?.skipTimeline) {
    await appendLocalTimeline({
      id: newId("evt"),
      relationshipId,
      type: "status_changed",
      title: `Moved to ${label}`,
      body: `Pipeline status → ${label}`,
      occurredAt: updatedAt,
      meta: { status: canonical },
    });

    if (hasLiveRelationshipsSync()) {
      const live = loadLiveStoreSync();
      if (live.relationships.some((r) => r.id === relationshipId)) {
        try {
          await appendTimelineEvent(relationshipId, {
            type: "status_changed",
            title: `Moved to ${label}`,
            body: `Pipeline status → ${label}`,
            occurredAt: updatedAt,
            meta: { status: canonical },
          });
        } catch {
          /* local ok */
        }
      }
    }
  }

  if (opts?.getRelationship && !opts.skipTimeline) {
    const pipeline = toPipelineStatus(canonical);
    await enrollOnStatusEnter(relationshipId, pipeline, opts.getRelationship);

    // Program 4 — commission ledger for commissionable status moves
    try {
      const { recordCommissionsForStatusMove } = await import("@/lib/program4/commissions");
      const { ensureProgram4Data } = await import("@/lib/program4/store");
      await ensureProgram4Data();
      const relationship = opts.getRelationship(relationshipId);
      if (relationship) {
        await recordCommissionsForStatusMove({
          relationship: { ...relationship, status: canonical },
          status: canonical,
          sourceEventId: `status_${relationshipId}_${canonical}_${updatedAt}`,
          occurredAt: updatedAt,
        });
      }
    } catch {
      /* commissions are best-effort */
    }
  }

  return { ok: true, status: canonical };
}
