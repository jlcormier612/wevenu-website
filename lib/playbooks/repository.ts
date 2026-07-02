import { createClient } from "@/integrations/supabase/server";
import type {
  EventReadiness,
  EventTask,
  PlaybookActionResult,
  PlaybookTask,
  PlaybookTemplate,
  TaskReminderRole,
  TaskStatus,
} from "@/lib/playbooks/types";

// Default reminder schedule when playbook_task has no reminderBeforeDays set.
// Venues can customize this per-task in a future sprint.
const DEFAULT_REMINDER_BEFORE_DAYS = [7, 3, 1];

type DbClient = Awaited<ReturnType<typeof createClient>>;

type TemplateRow = { id: string; venue_id: string; name: string; event_type: string | null; is_default: boolean; description: string | null; created_at: string; updated_at: string; };
type TaskRow = { id: string; template_id: string; venue_id: string; title: string; description: string | null; owner_type: string; visibility: string; days_offset: number; category: string; phase: string | null; auto_complete_trigger: string | null; depends_on_task_id: string | null; is_required: boolean; sort_order: number; created_at: string; reminder_before_days: number[] | null; escalation_after_days: number | null; notify_on_assign: boolean; notify_on_complete: boolean; };
type EventTaskRow = { id: string; venue_id: string; event_id: string; template_task_id: string | null; title: string; description: string | null; owner_type: string; visibility: string; due_date: string; days_offset: number; category: string; phase: string | null; auto_complete_trigger: string | null; is_required: boolean; status: string; depends_on_event_task_id: string | null; depends_on_title?: string | null; completed_at: string | null; completed_by: string | null; notes: string | null; sort_order: number; created_at: string; updated_at: string; reminder_before_days: number[] | null; escalation_after_days: number | null; notify_on_assign: boolean; notify_on_complete: boolean; };

const mapTemplate = (r: TemplateRow): PlaybookTemplate => ({ id: r.id, venueId: r.venue_id, name: r.name, eventType: r.event_type, isDefault: r.is_default, description: r.description, createdAt: r.created_at, updatedAt: r.updated_at });
const mapTask = (r: TaskRow): PlaybookTask => ({ id: r.id, templateId: r.template_id, venueId: r.venue_id, title: r.title, description: r.description, ownerType: r.owner_type as PlaybookTask["ownerType"], visibility: r.visibility as PlaybookTask["visibility"], daysOffset: r.days_offset, category: r.category as PlaybookTask["category"], phase: (r.phase as PlaybookTask["phase"]) ?? null, autoCompleteTrigger: r.auto_complete_trigger, dependsOnTaskId: r.depends_on_task_id, isRequired: r.is_required, sortOrder: r.sort_order, createdAt: r.created_at, reminderBeforeDays: r.reminder_before_days ?? null, escalationAfterDays: r.escalation_after_days ?? null, notifyOnAssign: r.notify_on_assign, notifyOnComplete: r.notify_on_complete });
const mapEventTask = (r: EventTaskRow): EventTask => ({ id: r.id, venueId: r.venue_id, eventId: r.event_id, templateTaskId: r.template_task_id, title: r.title, description: r.description, ownerType: r.owner_type as EventTask["ownerType"], visibility: r.visibility as EventTask["visibility"], dueDate: r.due_date, daysOffset: r.days_offset, category: r.category as EventTask["category"], phase: (r.phase as EventTask["phase"]) ?? null, autoCompleteTrigger: r.auto_complete_trigger, isRequired: r.is_required, status: computeStatus(r), dependsOnEventTaskId: r.depends_on_event_task_id, dependsOnTitle: r.depends_on_title ?? null, completedAt: r.completed_at, completedBy: r.completed_by, notes: r.notes, sortOrder: r.sort_order, createdAt: r.created_at, updatedAt: r.updated_at, reminderBeforeDays: r.reminder_before_days ?? null, escalationAfterDays: r.escalation_after_days ?? null, notifyOnAssign: r.notify_on_assign, notifyOnComplete: r.notify_on_complete });

function computeStatus(r: EventTaskRow): TaskStatus {
  if (r.status === "complete" || r.status === "waived") return r.status as TaskStatus;
  if (r.status === "blocked") return "blocked";
  if (new Date(r.due_date) < new Date(new Date().toISOString().slice(0, 10) + "T00:00:00")) return "overdue";
  return "pending";
}

// ---- Templates ---------------------------------------------------------------

export async function getTemplates(client: DbClient, venueId: string): Promise<PlaybookTemplate[]> {
  const { data, error } = await client.from("playbook_templates").select("*").eq("venue_id", venueId).order("name");
  if (error) throw error;
  return (data as TemplateRow[]).map(mapTemplate);
}

export async function getTemplate(client: DbClient, venueId: string, id: string): Promise<PlaybookTemplate | null> {
  const { data } = await client.from("playbook_templates").select("*").eq("id", id).eq("venue_id", venueId).maybeSingle<TemplateRow>();
  return data ? mapTemplate(data) : null;
}

export async function insertTemplate(client: DbClient, venueId: string, name: string, eventType: string | null, description: string | null): Promise<string> {
  const { data, error } = await client.from("playbook_templates").insert({ venue_id: venueId, name: name.trim(), event_type: eventType || null, description: description?.trim() || null }).select("id").single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

export async function deleteTemplate(client: DbClient, venueId: string, id: string): Promise<void> {
  const { error } = await client.from("playbook_templates").delete().eq("id", id).eq("venue_id", venueId);
  if (error) throw error;
}

// ---- Template Tasks ----------------------------------------------------------

export async function getTemplateTasks(client: DbClient, venueId: string, templateId: string): Promise<PlaybookTask[]> {
  const { data, error } = await client.from("playbook_tasks").select("*").eq("template_id", templateId).eq("venue_id", venueId).order("sort_order").order("days_offset");
  if (error) throw error;
  return (data as TaskRow[]).map(mapTask);
}

export async function insertTemplateTask(client: DbClient, venueId: string, templateId: string, task: Omit<PlaybookTask, "id" | "templateId" | "venueId" | "createdAt">): Promise<void> {
  const { error } = await client.from("playbook_tasks").insert({
    template_id: templateId, venue_id: venueId, title: task.title.trim(),
    description: task.description?.trim() || null, owner_type: task.ownerType,
    visibility: task.visibility, days_offset: task.daysOffset, category: task.category,
    phase: task.phase ?? null,
    auto_complete_trigger: task.autoCompleteTrigger || null,
    depends_on_task_id: task.dependsOnTaskId || null,
    is_required: task.isRequired, sort_order: task.sortOrder,
  });
  if (error) throw error;
}

export async function updateTemplateTask(client: DbClient, venueId: string, taskId: string, task: Partial<Omit<PlaybookTask, "id" | "templateId" | "venueId" | "createdAt">>): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (task.title !== undefined) patch.title = task.title.trim();
  if (task.description !== undefined) patch.description = task.description?.trim() || null;
  if (task.ownerType !== undefined) patch.owner_type = task.ownerType;
  if (task.visibility !== undefined) patch.visibility = task.visibility;
  if (task.daysOffset !== undefined) patch.days_offset = task.daysOffset;
  if (task.category !== undefined) patch.category = task.category;
  if (task.phase !== undefined) patch.phase = task.phase ?? null;
  if (task.autoCompleteTrigger !== undefined) patch.auto_complete_trigger = task.autoCompleteTrigger || null;
  if (task.dependsOnTaskId !== undefined) patch.depends_on_task_id = task.dependsOnTaskId || null;
  if (task.isRequired !== undefined) patch.is_required = task.isRequired;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("playbook_tasks") as any).update(patch).eq("id", taskId).eq("venue_id", venueId);
  if (error) throw error;
}

export async function deleteTemplateTask(client: DbClient, venueId: string, taskId: string): Promise<void> {
  const { error } = await client.from("playbook_tasks").delete().eq("id", taskId).eq("venue_id", venueId);
  if (error) throw error;
}

// ---- Event Tasks -------------------------------------------------------------

export async function getEventTasks(client: DbClient, venueId: string, eventId: string): Promise<EventTask[]> {
  const { data, error } = await client.from("event_tasks")
    .select("*, dep:depends_on_event_task_id(title)")
    .eq("venue_id", venueId).eq("event_id", eventId)
    .order("sort_order").order("due_date");
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((r) => mapEventTask({ ...r, depends_on_title: r.dep?.title ?? null }));
}

export async function applyPlaybookToEvent(
  client: DbClient,
  venueId: string,
  eventId: string,
  templateId: string,
  eventDate: string,
): Promise<void> {
  const tasks = await getTemplateTasks(client, venueId, templateId);
  if (!tasks.length) return;

  const idMap = new Map<string, string>();

  for (const t of tasks.sort((a, b) => a.sortOrder - b.sortOrder)) {
    const dueDate = offsetDate(eventDate, t.daysOffset);
    const dependsOnEventTaskId = t.dependsOnTaskId ? idMap.get(t.dependsOnTaskId) ?? null : null;

    const { data: inserted, error } = await client.from("event_tasks")
      .insert({
        venue_id: venueId, event_id: eventId, template_task_id: t.id,
        title: t.title, description: t.description, owner_type: t.ownerType,
        visibility: t.visibility, due_date: dueDate, days_offset: t.daysOffset,
        category: t.category, phase: t.phase ?? null, auto_complete_trigger: t.autoCompleteTrigger,
        depends_on_event_task_id: dependsOnEventTaskId,
        is_required: t.isRequired, sort_order: t.sortOrder,
        status: dependsOnEventTaskId !== null ? "blocked" : "pending",
        // Propagate notification rules from template
        reminder_before_days: t.reminderBeforeDays,
        escalation_after_days: t.escalationAfterDays,
        notify_on_assign: t.notifyOnAssign,
        notify_on_complete: t.notifyOnComplete,
      })
      .select("id").single<{ id: string }>();
    if (error) throw error;

    idMap.set(t.id, inserted.id);

    // Generate reminder records immediately — pending until Sprint 44 delivery engine
    await createRemindersForTask(client, venueId, inserted.id, dueDate, t);
  }
}

/** Generate task_reminder records for a newly-created event task.
 *  All reminders are created in 'pending' status — the Sprint 44 delivery engine will process them.
 */
async function createRemindersForTask(
  client: DbClient,
  venueId: string,
  eventTaskId: string,
  dueDate: string,          // "YYYY-MM-DD"
  task: Pick<PlaybookTask, "ownerType" | "reminderBeforeDays" | "escalationAfterDays" | "notifyOnAssign">,
): Promise<void> {
  const reminders: Array<{
    venue_id: string; event_task_id: string;
    reminder_type: string; notify_role: string; scheduled_for: string;
  }> = [];

  const notifyRole: TaskReminderRole = task.ownerType === "couple" ? "couple"
    : task.ownerType === "vendor" ? "vendor"
    : "coordinator";

  const beforeDays = task.reminderBeforeDays ?? DEFAULT_REMINDER_BEFORE_DAYS;
  const dueMidnight = dueDate + "T08:00:00Z"; // send reminder at 8am UTC on that day

  // Pre-due-date reminders (e.g., 7 days before, 3 days before, 1 day before)
  for (const days of beforeDays) {
    const scheduledFor = offsetDatetime(dueMidnight, -days);
    // Only schedule if the reminder is in the future
    if (new Date(scheduledFor) > new Date()) {
      reminders.push({
        venue_id: venueId, event_task_id: eventTaskId,
        reminder_type: "upcoming", notify_role: notifyRole,
        scheduled_for: scheduledFor,
      });
    }
  }

  // Day-of reminder
  reminders.push({
    venue_id: venueId, event_task_id: eventTaskId,
    reminder_type: "due_today", notify_role: notifyRole,
    scheduled_for: dueMidnight,
  });

  // Overdue escalation (always to coordinator regardless of task owner)
  if (task.escalationAfterDays) {
    reminders.push({
      venue_id: venueId, event_task_id: eventTaskId,
      reminder_type: "escalation", notify_role: "coordinator",
      scheduled_for: offsetDatetime(dueMidnight, task.escalationAfterDays),
    });
  } else {
    // Default: escalate to coordinator 3 days after overdue if no custom rule
    reminders.push({
      venue_id: venueId, event_task_id: eventTaskId,
      reminder_type: "overdue", notify_role: "coordinator",
      scheduled_for: offsetDatetime(dueMidnight, 3),
    });
  }

  if (!reminders.length) return;
  await client.from("task_reminders").insert(reminders);
}

/** Cancel all pending reminders for a task (called when task is completed or waived). */
export async function cancelRemindersForTask(client: DbClient, venueId: string, eventTaskId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client.from("task_reminders") as any)
    .update({ status: "cancelled" })
    .eq("event_task_id", eventTaskId)
    .eq("venue_id", venueId)
    .eq("status", "pending");
}

function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function offsetDatetime(datetimeStr: string, days: number): string {
  const d = new Date(datetimeStr);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export async function completeEventTask(
  client: DbClient,
  venueId: string,
  taskId: string,
  completedBy = "coordinator",
  sourceType?: string,
  sourceId?: string,
): Promise<void> {
  const patch: Record<string, unknown> = {
    status: "complete", completed_at: new Date().toISOString(), completed_by: completedBy,
  };
  if (sourceType) patch.source_type = sourceType;
  if (sourceId) patch.source_id = sourceId;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client.from("event_tasks") as any).update(patch).eq("id", taskId).eq("venue_id", venueId);
  // Cancel pending reminders — task is done, no more notifications needed
  await cancelRemindersForTask(client, venueId, taskId);
  // Unblock dependent tasks
  await unblockedependents(client, venueId, taskId);
}

export async function updateEventTaskStatus(
  client: DbClient,
  venueId: string,
  taskId: string,
  status: "waived" | "pending",
): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (status === "pending") patch.completed_at = null; // un-complete
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client.from("event_tasks") as any).update(patch).eq("id", taskId).eq("venue_id", venueId);
}

/** Auto-complete tasks matching a trigger for a given event. */
export async function autoCompleteTrigger(
  client: DbClient,
  venueId: string,
  eventId: string,
  trigger: string,
  sourceType?: string,
  sourceId?: string,
): Promise<void> {
  const { data } = await client.from("event_tasks").select("id")
    .eq("venue_id", venueId).eq("event_id", eventId)
    .eq("auto_complete_trigger", trigger)
    .in("status", ["pending", "blocked", "overdue"]);
  for (const { id } of (data ?? []) as { id: string }[]) {
    await completeEventTask(client, venueId, id, "system", sourceType, sourceId);
  }
}

async function unblockedependents(client: DbClient, venueId: string, completedTaskId: string): Promise<void> {
  const { data: blocked } = await client.from("event_tasks").select("id")
    .eq("depends_on_event_task_id", completedTaskId).eq("status", "blocked").eq("venue_id", venueId);
  for (const { id } of (blocked ?? []) as { id: string }[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client.from("event_tasks") as any).update({ status: "pending" }).eq("id", id).eq("venue_id", venueId);
  }
}

// ---- Event Readiness (replaces computeEventReadiness) -----------------------

export async function computeEventReadinessFromPlaybook(
  client: DbClient,
  venueId: string,
  clientId: string,
): Promise<EventReadiness | null> {
  // Find linked event
  const { data: events } = await client.from("events")
    .select("id, event_date").eq("venue_id", venueId).eq("client_id", clientId)
    .not("status", "in", "(cancelled,complete)").order("event_date").limit(1);
  const event = (events as { id: string; event_date: string }[] | null)?.[0];
  if (!event) return null;

  const tasks = await getEventTasks(client, venueId, event.id);
  if (!tasks.length) return null; // no playbook applied yet

  const required = tasks.filter((t) => t.isRequired);
  const optional = tasks.filter((t) => !t.isRequired);
  const completedRequired = required.filter((t) => t.status === "complete").length;
  const completedOptional = optional.filter((t) => t.status === "complete").length;
  const score = required.length > 0 ? Math.round((completedRequired / required.length) * 100) : 0;

  return {
    score,
    completedRequired,
    totalRequired: required.length,
    completedOptional,
    totalOptional: optional.length,
    tasks,
    blockedCount: tasks.filter((t) => t.status === "blocked").length,
    overdueCount: tasks.filter((t) => t.status === "overdue").length,
  };
}
