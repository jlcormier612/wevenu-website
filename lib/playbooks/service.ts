import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  STANDARD_CLIENT_PLANNING_MILESTONES, STANDARD_CLIENT_PLANNING_TASKS,
  STANDARD_VENUE_WORKFLOW_MILESTONES, STANDARD_VENUE_WORKFLOW_TASKS,
} from "@/lib/playbooks/constants";
import * as repo from "@/lib/playbooks/repository";
import type {
  CreatePlaybookResult,
  EventPlaybookApplication,
  EventReadiness,
  EventTask,
  EventTaskContextLink,
  EventTaskContextSourceType,
  ImportPlaybookResult,
  PlaybookActionResult,
  PlaybookKind,
  PlaybookMilestone,
  PlaybookTask,
  PlaybookTaskAttachment,
  PlaybookTemplate,
  PlaybookTemplateWithStats,
  TaskContact,
} from "@/lib/playbooks/types";
import { proposePlaybookDraft } from "@/lib/luv/playbook-import";
import { getTeamMembers } from "@/lib/team/service";
import { getCurrentVenue } from "@/lib/venue/service";

async function withVenue<T>(fn: (c: Awaited<ReturnType<typeof createClient>>, venueId: string) => Promise<T>): Promise<T | PlaybookActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  return fn(supabase, venue.id);
}

// ---- Templates ---------------------------------------------------------------

export async function getTemplates(): Promise<PlaybookTemplate[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getTemplates(await createClient(), venue.id);
}

// The Planning Template Library page — every template including archived,
// with task/usage counts for the card grid.
export async function getTemplatesForLibrary(): Promise<PlaybookTemplateWithStats[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getTemplatesWithStats(await createClient(), venue.id);
}

export async function createTemplate(name: string, kind: PlaybookKind, eventType: string | null, description: string | null): Promise<CreatePlaybookResult> {
  if (!name.trim()) return { ok: false, message: "Template name is required." };
  const result = await withVenue(async (c, venueId) => {
    const templateId = await repo.insertTemplate(c, venueId, name, kind, eventType, description);
    return { ok: true, templateId } as CreatePlaybookResult;
  });
  return result as CreatePlaybookResult;
}

export async function renameTemplate_(id: string, name: string): Promise<PlaybookActionResult> {
  if (!name.trim()) return { ok: false, message: "Template name is required." };
  const result = await withVenue(async (c, venueId) => {
    await repo.renameTemplate(c, venueId, id, name);
    return { ok: true } as PlaybookActionResult;
  });
  return result as PlaybookActionResult;
}

export async function setTemplateDefault_(id: string): Promise<PlaybookActionResult> {
  const result = await withVenue(async (c, venueId) => {
    const template = await repo.getTemplate(c, venueId, id);
    if (!template) return { ok: false, message: "Template not found." } as PlaybookActionResult;
    await repo.setTemplateDefault(c, venueId, id, template.eventType, template.kind);
    return { ok: true } as PlaybookActionResult;
  });
  return result as PlaybookActionResult;
}

export async function setTemplateArchived_(id: string, isArchived: boolean): Promise<PlaybookActionResult> {
  const result = await withVenue(async (c, venueId) => {
    await repo.setTemplateArchived(c, venueId, id, isArchived);
    return { ok: true } as PlaybookActionResult;
  });
  return result as PlaybookActionResult;
}

export async function deleteTemplate_(id: string): Promise<PlaybookActionResult> {
  const result = await withVenue(async (c, venueId) => {
    await repo.deleteTemplate(c, venueId, id);
    return { ok: true } as PlaybookActionResult;
  });
  return result as PlaybookActionResult;
}

// ---- Milestones ---------------------------------------------------------------

export async function getMilestones(templateId: string): Promise<PlaybookMilestone[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getMilestones(await createClient(), venue.id, templateId);
}

export async function addMilestone(templateId: string, name: string, sortOrder: number): Promise<PlaybookActionResult & { id?: string }> {
  if (!name.trim()) return { ok: false, message: "Milestone name is required." };
  const result = await withVenue(async (c, venueId) => {
    const id = await repo.insertMilestone(c, venueId, templateId, name, sortOrder);
    return { ok: true, id } as PlaybookActionResult & { id?: string };
  });
  return result as PlaybookActionResult & { id?: string };
}

export async function renameMilestone(milestoneId: string, name: string): Promise<PlaybookActionResult> {
  if (!name.trim()) return { ok: false, message: "Milestone name is required." };
  const result = await withVenue(async (c, venueId) => {
    await repo.renameMilestone(c, venueId, milestoneId, name);
    return { ok: true } as PlaybookActionResult;
  });
  return result as PlaybookActionResult;
}

export async function setMilestoneKind(templateId: string, milestoneId: string, kind: PlaybookMilestone["kind"]): Promise<PlaybookActionResult> {
  const result = await withVenue(async (c, venueId) => {
    await repo.setMilestoneKind(c, venueId, templateId, milestoneId, kind);
    return { ok: true } as PlaybookActionResult;
  });
  return result as PlaybookActionResult;
}

export async function reorderMilestone(templateId: string, milestoneId: string, direction: "up" | "down"): Promise<PlaybookActionResult> {
  const result = await withVenue(async (c, venueId) => {
    await repo.reorderMilestone(c, venueId, templateId, milestoneId, direction);
    return { ok: true } as PlaybookActionResult;
  });
  return result as PlaybookActionResult;
}

export async function deleteMilestone(milestoneId: string): Promise<PlaybookActionResult> {
  const result = await withVenue(async (c, venueId) => {
    await repo.deleteMilestone(c, venueId, milestoneId);
    return { ok: true } as PlaybookActionResult;
  });
  return result as PlaybookActionResult;
}

// ---- Template Tasks ----------------------------------------------------------

export async function getTemplate(id: string): Promise<PlaybookTemplate | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return repo.getTemplate(await createClient(), venue.id, id);
}

export async function getTemplateTasks(templateId: string): Promise<PlaybookTask[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getTemplateTasks(await createClient(), venue.id, templateId);
}

export async function addTemplateTask(templateId: string, task: Omit<PlaybookTask, "id" | "templateId" | "venueId" | "createdAt">): Promise<PlaybookActionResult & { taskId?: string }> {
  const result = await withVenue(async (c, venueId) => {
    const taskId = await repo.insertTemplateTask(c, venueId, templateId, task);
    return { ok: true, taskId } as PlaybookActionResult & { taskId?: string };
  });
  return result as PlaybookActionResult & { taskId?: string };
}

export async function updateTemplateTask_(taskId: string, patch: Partial<Omit<PlaybookTask, "id" | "templateId" | "venueId" | "createdAt">>): Promise<PlaybookActionResult> {
  const result = await withVenue(async (c, venueId) => {
    await repo.updateTemplateTask(c, venueId, taskId, patch);
    return { ok: true } as PlaybookActionResult;
  });
  return result as PlaybookActionResult;
}

export async function deleteTemplateTask_(taskId: string): Promise<PlaybookActionResult> {
  const result = await withVenue(async (c, venueId) => {
    await repo.deleteTemplateTask(c, venueId, taskId);
    return { ok: true } as PlaybookActionResult;
  });
  return result as PlaybookActionResult;
}

// ---- Template attachments (upload / attach existing document / add link) ----

export async function getPlaybookTaskAttachments(playbookTaskId: string): Promise<PlaybookTaskAttachment[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getPlaybookTaskAttachments(await createClient(), venue.id, playbookTaskId);
}

export async function getPlaybookTaskAttachmentsForTemplate(templateId: string): Promise<Record<string, PlaybookTaskAttachment[]>> {
  if (!isSupabaseConfigured) return {};
  const venue = await getCurrentVenue();
  if (!venue) return {};
  return repo.getPlaybookTaskAttachmentsForTemplate(await createClient(), venue.id, templateId);
}

export async function addPlaybookTaskAttachment(
  playbookTaskId: string,
  attachment: { documentId: string } | { linkUrl: string; linkLabel: string | null },
  sortOrder: number,
): Promise<PlaybookActionResult> {
  const result = await withVenue(async (c, venueId) => {
    await repo.addPlaybookTaskAttachment(c, venueId, playbookTaskId, attachment, sortOrder);
    return { ok: true } as PlaybookActionResult;
  });
  return result as PlaybookActionResult;
}

export async function removePlaybookTaskAttachment(attachmentId: string): Promise<PlaybookActionResult> {
  const result = await withVenue(async (c, venueId) => {
    await repo.removePlaybookTaskAttachment(c, venueId, attachmentId);
    return { ok: true } as PlaybookActionResult;
  });
  return result as PlaybookActionResult;
}

// ---- Event Tasks -------------------------------------------------------------

export async function getEventTasks(eventId: string): Promise<EventTask[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getEventTasks(await createClient(), venue.id, eventId);
}

export async function getEventPlaybookApplications(eventId: string): Promise<EventPlaybookApplication[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getEventPlaybookApplications(await createClient(), venue.id, eventId);
}

export async function applyPlaybookToEvent(eventId: string, templateId: string, eventDate: string): Promise<PlaybookActionResult> {
  const result = await withVenue(async (c, venueId) => {
    const applied = await repo.applyPlaybookToEvent(c, venueId, eventId, templateId, eventDate);
    if (!applied.ok) {
      const template = await repo.getTemplate(c, venueId, templateId);
      const kindLabel = template?.kind === "client" ? "Client Planning" : "Venue Planning";
      return {
        ok: false,
        message: `This event already has a ${kindLabel} checklist applied. Remove its existing tasks first if you need to start over — replacing or merging isn't supported yet.`,
      } as PlaybookActionResult;
    }
    return { ok: true } as PlaybookActionResult;
  });
  return result as PlaybookActionResult;
}

/** The deliberate second step for Client Planning (Draft → Release,
 *  2026-07-10): makes the checklist visible in the couple portal and starts
 *  its reminders. Also makes sure a portal link actually exists for this
 *  client — releasing with no link would leave "View Client Portal" pointing
 *  at nothing, and most clients already have one from booking anyway. */
export async function releasePlaybookApplication(eventId: string, clientId: string, coupleName: string): Promise<PlaybookActionResult> {
  const result = await withVenue(async (c, venueId) => {
    const released = await repo.releasePlaybookApplication(c, venueId, eventId);
    if (!released.ok) {
      return {
        ok: false,
        message: released.reason === "already_released"
          ? "This checklist has already been released."
          : "Apply a Client Planning checklist to this event before releasing it.",
      } as PlaybookActionResult;
    }

    const { getPortalSessions, createPortalSession } = await import("@/lib/portal/service");
    const sessions = await getPortalSessions(clientId);
    if (sessions.length === 0) await createPortalSession(clientId, coupleName);

    return { ok: true } as PlaybookActionResult;
  });
  return result as PlaybookActionResult;
}

/** Coordinator manually overrides one task's due date on this event — it stops tracking the event date automatically. */
export async function updateEventTaskDueDate(taskId: string, newDueDate: string): Promise<PlaybookActionResult> {
  const result = await withVenue(async (c, venueId) => {
    await repo.updateEventTaskDueDate(c, venueId, taskId, newDueDate);
    return { ok: true } as PlaybookActionResult;
  });
  return result as PlaybookActionResult;
}

/** Called when an event's date changes — keeps every non-overridden relative-to-event task in sync (Product Decisions, 2026-07-08). */
export async function recalculateEventTaskDueDates(eventId: string, newEventDate: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const venue = await getCurrentVenue();
  if (!venue) return;
  await repo.recalculateEventTaskDueDates(await createClient(), venue.id, eventId, newEventDate);
}

/** Links this task to a Request Framework record (or unlinks when requestId is null). Task and Request lifecycles stay independent — this never changes task status. */
export async function setEventTaskRequest(taskId: string, requestId: string | null): Promise<PlaybookActionResult> {
  const result = await withVenue(async (c, venueId) => {
    await repo.setEventTaskRequest(c, venueId, taskId, requestId);
    return { ok: true } as PlaybookActionResult;
  });
  return result as PlaybookActionResult;
}

export async function completeEventTask_(taskId: string, completedBy?: string): Promise<PlaybookActionResult> {
  const result = await withVenue(async (c, venueId) => {
    await repo.completeEventTask(c, venueId, taskId, completedBy);
    return { ok: true } as PlaybookActionResult;
  });
  return result as PlaybookActionResult;
}

export async function setEventTaskStatus(taskId: string, status: "waived" | "pending"): Promise<PlaybookActionResult> {
  const result = await withVenue(async (c, venueId) => {
    await repo.updateEventTaskStatus(c, venueId, taskId, status);
    return { ok: true } as PlaybookActionResult;
  });
  return result as PlaybookActionResult;
}

// ---- Scheduled Activity (Calendar Integration — Phase 1) ---------------------

export async function updateEventTaskSchedule(taskId: string, input: repo.ScheduleInput): Promise<PlaybookActionResult> {
  const result = await withVenue(async (c, venueId) => {
    await repo.updateEventTaskSchedule(c, venueId, taskId, input);
    return { ok: true } as PlaybookActionResult;
  });
  return result as PlaybookActionResult;
}

// ---- Internal Notes ------------------------------------------------------------

export async function updateEventTaskNotes(taskId: string, notes: string): Promise<PlaybookActionResult> {
  const result = await withVenue(async (c, venueId) => {
    await repo.updateEventTaskNotes(c, venueId, taskId, notes);
    return { ok: true } as PlaybookActionResult;
  });
  return result as PlaybookActionResult;
}

export async function updateEventTaskAssignment(taskId: string, staffId: string | null): Promise<PlaybookActionResult> {
  const result = await withVenue(async (c, venueId) => {
    await repo.updateEventTaskAssignment(c, venueId, taskId, staffId);
    return { ok: true } as PlaybookActionResult;
  });
  return result as PlaybookActionResult;
}

// ---- Related Context -------------------------------------------------------

export async function getEventTaskContextLinks(taskId: string): Promise<EventTaskContextLink[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getEventTaskContextLinks(await createClient(), venue.id, taskId);
}

export async function getEventTaskContextLinksForEvent(eventId: string): Promise<Record<string, EventTaskContextLink[]>> {
  if (!isSupabaseConfigured) return {};
  const venue = await getCurrentVenue();
  if (!venue) return {};
  return repo.getEventTaskContextLinksForEvent(await createClient(), venue.id, eventId);
}

export async function addEventTaskContextLink(taskId: string, sourceType: EventTaskContextSourceType, sourceId: string, linkLabel?: string): Promise<PlaybookActionResult> {
  const result = await withVenue(async (c, venueId) => {
    await repo.addEventTaskContextLink(c, venueId, taskId, sourceType, sourceId, linkLabel);
    return { ok: true } as PlaybookActionResult;
  });
  return result as PlaybookActionResult;
}

export async function removeEventTaskContextLink(linkId: string): Promise<PlaybookActionResult> {
  const result = await withVenue(async (c, venueId) => {
    await repo.removeEventTaskContextLink(c, venueId, linkId);
    return { ok: true } as PlaybookActionResult;
  });
  return result as PlaybookActionResult;
}

// ---- Task contact line ------------------------------------------------------
// Defaulted from the assigned coordinator, falling back to the venue's own
// profile — never a field re-typed per task (Planning Experience Review,
// 2026-07-08; Standard #12, One Fact, One Owner).

export async function getTaskContact(assignedToStaffId: string | null): Promise<TaskContact | null> {
  const venue = await getCurrentVenue();
  if (!venue) return null;
  if (assignedToStaffId) {
    const staff = await getTeamMembers(venue.id);
    const match = staff.find((s) => s.id === assignedToStaffId);
    if (match) return { name: match.name, email: match.email };
  }
  if (!venue.email && !venue.name) return null;
  return { name: venue.name, email: venue.email };
}

/** Batch form of getTaskContact — one team-member fetch instead of one per task. Key is assignedToStaffId, or "" for the venue default. */
export async function getTaskContactsByStaffIds(assignedToStaffIds: (string | null)[]): Promise<Record<string, TaskContact>> {
  const venue = await getCurrentVenue();
  if (!venue) return {};
  const staff = await getTeamMembers(venue.id);
  const result: Record<string, TaskContact> = {};
  const fallback: TaskContact | null = venue.email || venue.name ? { name: venue.name, email: venue.email } : null;
  for (const id of new Set(assignedToStaffIds)) {
    const match = id ? staff.find((s) => s.id === id) : null;
    const contact = match ? { name: match.name, email: match.email } : fallback;
    if (contact) result[id ?? ""] = contact;
  }
  return result;
}

/** Call this after any milestone event fires — auto-completes matching tasks. */
export async function triggerAutoComplete(
  supabase: Awaited<ReturnType<typeof createClient>>,
  venueId: string,
  eventId: string,
  trigger: string,
  sourceType?: string,
  sourceId?: string,
): Promise<void> {
  await repo.autoCompleteTrigger(supabase, venueId, eventId, trigger, sourceType, sourceId);
}

// ---- Event Readiness (replaces hardcoded computeEventReadiness) -------------

export async function getEventReadiness(clientId: string): Promise<EventReadiness | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return repo.computeEventReadinessFromPlaybook(await createClient(), venue.id, clientId);
}

// Client Planning and Venue Planning readiness, computed independently —
// the event Planning tab's two-progress-bar view, never merged into one
// number (Planning Experience Review, 2026-07-08). Distinct from
// getEventReadiness above, which intentionally stays a single merged summary
// for the simpler Client-page "Planning Progress" widget.
export async function getEventTaskReadinessByKind(eventId: string): Promise<{ client: EventReadiness | null; venue: EventReadiness | null }> {
  if (!isSupabaseConfigured) return { client: null, venue: null };
  const venue = await getCurrentVenue();
  if (!venue) return { client: null, venue: null };
  return repo.computeEventTaskReadinessByKind(await createClient(), venue.id, eventId);
}

// ---- Create from the Standard reference templates ---------------------------
// Two reference implementations, both named "Standard Wedding" — one Client
// Planning, one Venue Planning — grouped together under Wedding in the
// Template Library (Planning Templates UX Rebuild, 2026-07-09). Always
// creates a new template; a venue can start several from the same starting
// point and customize each independently. Returns the new templateId so the
// caller can navigate straight into the editor ("applies immediately").

async function createFromReference(
  c: Awaited<ReturnType<typeof createClient>>, venueId: string,
  name: string, kind: PlaybookKind, eventType: string | null, description: string,
  milestones: { name: string; kind: import("@/lib/playbooks/types").MilestoneKind | null }[],
  tasks: (Omit<PlaybookTask, "id" | "templateId" | "venueId" | "createdAt" | "milestoneId"> & { milestoneIndex: number })[],
): Promise<string> {
  const templateId = await repo.insertTemplate(c, venueId, name, kind, eventType, description);
  const milestoneIds: string[] = [];
  for (let i = 0; i < milestones.length; i++) {
    const m = milestones[i];
    milestoneIds.push(await repo.insertMilestone(c, venueId, templateId, m.name, i, m.kind ?? undefined));
  }
  for (const { milestoneIndex, ...task } of tasks) {
    await repo.insertTemplateTask(c, venueId, templateId, { ...task, milestoneId: milestoneIds[milestoneIndex] });
  }
  return templateId;
}

export async function createStandardClientPlanningTemplate(): Promise<CreatePlaybookResult> {
  const result = await withVenue(async (c, venueId) => {
    const templateId = await createFromReference(
      c, venueId, "Standard Wedding", "client", "wedding",
      "Guides your client through their own to-dos, from booking through post-event.",
      STANDARD_CLIENT_PLANNING_MILESTONES, STANDARD_CLIENT_PLANNING_TASKS,
    );
    return { ok: true, templateId } as CreatePlaybookResult;
  });
  return result as CreatePlaybookResult;
}

export async function createStandardVenueWorkflowTemplate(): Promise<CreatePlaybookResult> {
  const result = await withVenue(async (c, venueId) => {
    const templateId = await createFromReference(
      c, venueId, "Standard Wedding", "venue", "wedding",
      "Runs your team's internal checklist, from booking through post-event.",
      STANDARD_VENUE_WORKFLOW_MILESTONES, STANDARD_VENUE_WORKFLOW_TASKS,
    );
    return { ok: true, templateId } as CreatePlaybookResult;
  });
  return result as CreatePlaybookResult;
}

// ---- Bring Your Existing Checklist (2026-07-10) -----------------------------
// Luv reads the pasted text once and proposes a structure; the result is
// created as a real template through the same createFromReference path the
// "Standard Wedding" starter already uses, then the coordinator lands
// directly in the Template Editor to review it — no separate "review the
// AI's work" screen (docs/planning-templates-import.md).

export async function createTemplateFromImport(rawText: string, kind: PlaybookKind, name: string): Promise<ImportPlaybookResult> {
  if (!name.trim()) return { ok: false, message: "Give this checklist a name." };

  const proposal = await proposePlaybookDraft(rawText, kind);
  if (!proposal.ok) return { ok: false, message: proposal.message };

  const result = await withVenue(async (c, venueId) => {
    const milestones = proposal.milestones.map((m) => ({ name: m.name, kind: null }));
    const tasks: (Omit<PlaybookTask, "id" | "templateId" | "venueId" | "createdAt" | "milestoneId"> & { milestoneIndex: number })[] = [];
    let guessedCount = 0;
    proposal.milestones.forEach((m, milestoneIndex) => {
      m.tasks.forEach((t, sortOrder) => {
        if (t.guessed) guessedCount += 1;
        tasks.push({
          title: t.title,
          description: t.instructions || null,
          ownerType: kind === "client" ? "couple" : "coordinator",
          visibility: kind === "client" ? "client_owned" : "coordinator_only",
          daysOffset: t.daysOffset,
          dueDateRuleKind: "relative_to_event",
          category: "planning",
          milestoneIndex,
          autoCompleteTrigger: null,
          dependsOnTaskId: null,
          isRequired: true,
          sortOrder,
          reminderBeforeDays: null,
          escalationAfterDays: null,
          notifyOnAssign: false,
          notifyOnComplete: false,
          actionType: null,
          actionLabel: null,
        });
      });
    });

    const templateId = await createFromReference(
      c, venueId, name.trim(), kind, null,
      "Imported from an existing checklist.",
      milestones, tasks,
    );
    return { ok: true, templateId, taskCount: tasks.length, guessedCount } as ImportPlaybookResult;
  });
  return result as ImportPlaybookResult;
}

// ---- Duplicate an existing playbook -----------------------------------------
// Reuses the same template/milestone/task tables — a duplicate is just a new
// template row plus copies of its milestones and tasks, not a new mechanism.
// Always the same kind as its source — duplicating a Client Planning playbook
// makes another Client Planning playbook, never a Venue Planning one.

export async function duplicateTemplate(sourceTemplateId: string, newName: string): Promise<CreatePlaybookResult> {
  if (!newName.trim()) return { ok: false, message: "Template name is required." };
  const result = await withVenue(async (c, venueId) => {
    const source = await repo.getTemplate(c, venueId, sourceTemplateId);
    if (!source) return { ok: false, message: "Template not found." } as CreatePlaybookResult;

    const templateId = await repo.duplicateTemplateInto(c, venueId, sourceTemplateId, newName, source.kind, source.eventType, source.description);
    return { ok: true, templateId } as CreatePlaybookResult;
  });
  return result as CreatePlaybookResult;
}
