import { createClient } from "@/integrations/supabase/server";
import type {
  EventReadiness,
  EventTask,
  PlaybookActionResult,
  PlaybookTask,
  PlaybookTemplate,
  TaskStatus,
} from "@/lib/playbooks/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

type TemplateRow = { id: string; venue_id: string; name: string; event_type: string | null; is_default: boolean; description: string | null; created_at: string; updated_at: string; };
type TaskRow = { id: string; template_id: string; venue_id: string; title: string; description: string | null; owner_type: string; visibility: string; days_offset: number; category: string; auto_complete_trigger: string | null; depends_on_task_id: string | null; is_required: boolean; sort_order: number; created_at: string; };
type EventTaskRow = { id: string; venue_id: string; event_id: string; template_task_id: string | null; title: string; description: string | null; owner_type: string; visibility: string; due_date: string; days_offset: number; category: string; auto_complete_trigger: string | null; is_required: boolean; status: string; depends_on_event_task_id: string | null; depends_on_title?: string | null; completed_at: string | null; completed_by: string | null; notes: string | null; sort_order: number; created_at: string; updated_at: string; };

const mapTemplate = (r: TemplateRow): PlaybookTemplate => ({ id: r.id, venueId: r.venue_id, name: r.name, eventType: r.event_type, isDefault: r.is_default, description: r.description, createdAt: r.created_at, updatedAt: r.updated_at });
const mapTask = (r: TaskRow): PlaybookTask => ({ id: r.id, templateId: r.template_id, venueId: r.venue_id, title: r.title, description: r.description, ownerType: r.owner_type as PlaybookTask["ownerType"], visibility: r.visibility as PlaybookTask["visibility"], daysOffset: r.days_offset, category: r.category as PlaybookTask["category"], autoCompleteTrigger: r.auto_complete_trigger, dependsOnTaskId: r.depends_on_task_id, isRequired: r.is_required, sortOrder: r.sort_order, createdAt: r.created_at });
const mapEventTask = (r: EventTaskRow): EventTask => ({ id: r.id, venueId: r.venue_id, eventId: r.event_id, templateTaskId: r.template_task_id, title: r.title, description: r.description, ownerType: r.owner_type as EventTask["ownerType"], visibility: r.visibility as EventTask["visibility"], dueDate: r.due_date, daysOffset: r.days_offset, category: r.category as EventTask["category"], autoCompleteTrigger: r.auto_complete_trigger, isRequired: r.is_required, status: computeStatus(r), dependsOnEventTaskId: r.depends_on_event_task_id, dependsOnTitle: r.depends_on_title ?? null, completedAt: r.completed_at, completedBy: r.completed_by, notes: r.notes, sortOrder: r.sort_order, createdAt: r.created_at, updatedAt: r.updated_at });

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

  // Build a map of template_task_id → event_task_id for dependency linking
  const idMap = new Map<string, string>();

  // Insert in order (sort_order), so dependencies can be resolved
  for (const t of tasks.sort((a, b) => a.sortOrder - b.sortOrder)) {
    const date = new Date(eventDate + "T12:00:00");
    date.setDate(date.getDate() + t.daysOffset);
    const dueDate = date.toISOString().slice(0, 10);

    const dependsOnEventTaskId = t.dependsOnTaskId ? idMap.get(t.dependsOnTaskId) ?? null : null;
    const isBlocked = dependsOnEventTaskId !== null; // initially blocked if has dependency

    const { data: inserted, error } = await client.from("event_tasks")
      .insert({
        venue_id: venueId, event_id: eventId, template_task_id: t.id,
        title: t.title, description: t.description, owner_type: t.ownerType,
        visibility: t.visibility, due_date: dueDate, days_offset: t.daysOffset,
        category: t.category, auto_complete_trigger: t.autoCompleteTrigger,
        depends_on_event_task_id: dependsOnEventTaskId,
        is_required: t.isRequired, sort_order: t.sortOrder,
        status: isBlocked ? "blocked" : "pending",
      })
      .select("id").single<{ id: string }>();
    if (error) throw error;
    idMap.set(t.id, inserted.id);
  }
}

export async function completeEventTask(
  client: DbClient,
  venueId: string,
  taskId: string,
  completedBy = "coordinator",
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client.from("event_tasks") as any).update({
    status: "complete", completed_at: new Date().toISOString(), completed_by: completedBy,
  }).eq("id", taskId).eq("venue_id", venueId);
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
): Promise<void> {
  const { data } = await client.from("event_tasks").select("id")
    .eq("venue_id", venueId).eq("event_id", eventId)
    .eq("auto_complete_trigger", trigger)
    .in("status", ["pending", "blocked", "overdue"]);
  for (const { id } of (data ?? []) as { id: string }[]) {
    await completeEventTask(client, venueId, id, "system");
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
