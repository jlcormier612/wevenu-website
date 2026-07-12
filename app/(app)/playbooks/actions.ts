"use server";

import { revalidatePath } from "next/cache";
import {
  addEventTaskContextLink, addMilestone, addPlaybookTaskAttachment, addTemplateTask, applyPlaybookToEvent, completeEventTask_,
  createStandardClientPlanningTemplate, createStandardVenueWorkflowTemplate, createTemplate, createTemplateFromImport,
  deleteMilestone, deleteTemplate_, deleteTemplateTask_, duplicateTemplate,
  releasePlaybookApplication,
  removeEventTaskContextLink, removePlaybookTaskAttachment, renameMilestone, renameTemplate_, reorderMilestone,
  setEventTaskRequest, setEventTaskStatus, setTemplateArchived_, setTemplateDefault_, updateEventTaskDueDate, updateEventTaskNotes,
  updateEventTaskSchedule, updateTemplateTask_,
} from "@/lib/playbooks/service";
import type { ScheduleInput } from "@/lib/playbooks/repository";
import type { EventTaskContextSourceType, ImportPlaybookResult, PlaybookActionResult, PlaybookKind, PlaybookTask, CreatePlaybookResult } from "@/lib/playbooks/types";
import { createRequest } from "@/lib/requests/service";

export async function createTemplateAction(name: string, kind: PlaybookKind, eventType: string | null, description: string | null): Promise<CreatePlaybookResult> {
  const result = await createTemplate(name, kind, eventType, description);
  if (result.ok) revalidatePath("/library/playbooks");
  return result;
}

export async function deleteTemplateAction(id: string): Promise<PlaybookActionResult> {
  const result = await deleteTemplate_(id);
  if (result.ok) revalidatePath("/library/playbooks");
  return result;
}

export async function renameTemplateAction(id: string, name: string): Promise<PlaybookActionResult> {
  const result = await renameTemplate_(id, name);
  if (result.ok) revalidatePath("/library/playbooks");
  return result;
}

export async function setTemplateDefaultAction(id: string): Promise<PlaybookActionResult> {
  const result = await setTemplateDefault_(id);
  if (result.ok) revalidatePath("/library/playbooks");
  return result;
}

export async function setTemplateArchivedAction(id: string, isArchived: boolean): Promise<PlaybookActionResult> {
  const result = await setTemplateArchived_(id, isArchived);
  if (result.ok) revalidatePath("/library/playbooks");
  return result;
}

export async function addTemplateTaskAction(templateId: string, task: Omit<PlaybookTask, "id" | "templateId" | "venueId" | "createdAt">): Promise<PlaybookActionResult & { taskId?: string }> {
  const result = await addTemplateTask(templateId, task);
  if (result.ok) revalidatePath("/library/playbooks");
  return result;
}

export async function updateTemplateTaskAction(taskId: string, patch: Partial<Omit<PlaybookTask, "id" | "templateId" | "venueId" | "createdAt">>): Promise<PlaybookActionResult> {
  const result = await updateTemplateTask_(taskId, patch);
  if (result.ok) revalidatePath("/library/playbooks");
  return result;
}

export async function deleteTemplateTaskAction(taskId: string): Promise<PlaybookActionResult> {
  const result = await deleteTemplateTask_(taskId);
  if (result.ok) revalidatePath("/library/playbooks");
  return result;
}

export async function applyPlaybookAction(eventId: string, templateId: string, eventDate: string): Promise<PlaybookActionResult> {
  const result = await applyPlaybookToEvent(eventId, templateId, eventDate);
  if (result.ok) revalidatePath(`/events/${eventId}`);
  return result;
}

export async function releasePlaybookAction(eventId: string, clientId: string, coupleName: string): Promise<PlaybookActionResult> {
  const result = await releasePlaybookApplication(eventId, clientId, coupleName);
  if (result.ok) revalidatePath(`/events/${eventId}`);
  return result;
}

export async function completeTaskAction(taskId: string, eventId: string): Promise<PlaybookActionResult> {
  const result = await completeEventTask_(taskId);
  if (result.ok) revalidatePath(`/events/${eventId}`);
  return result;
}

export async function setTaskStatusAction(taskId: string, eventId: string, status: "waived" | "pending"): Promise<PlaybookActionResult> {
  const result = await setEventTaskStatus(taskId, status);
  if (result.ok) revalidatePath(`/events/${eventId}`);
  return result;
}

export async function createTemplateFromImportAction(rawText: string, kind: PlaybookKind, name: string): Promise<ImportPlaybookResult> {
  const result = await createTemplateFromImport(rawText, kind, name);
  if (result.ok) revalidatePath("/library/playbooks");
  return result;
}

export async function createStandardClientPlanningTemplateAction(): Promise<CreatePlaybookResult> {
  const result = await createStandardClientPlanningTemplate();
  if (result.ok) revalidatePath("/library/playbooks");
  return result;
}

export async function createStandardVenueWorkflowTemplateAction(): Promise<CreatePlaybookResult> {
  const result = await createStandardVenueWorkflowTemplate();
  if (result.ok) revalidatePath("/library/playbooks");
  return result;
}

export async function duplicateTemplateAction(sourceTemplateId: string, newName: string): Promise<CreatePlaybookResult> {
  const result = await duplicateTemplate(sourceTemplateId, newName);
  if (result.ok) revalidatePath("/library/playbooks");
  return result;
}

export async function updateEventTaskDueDateAction(taskId: string, eventId: string, newDueDate: string): Promise<PlaybookActionResult> {
  const result = await updateEventTaskDueDate(taskId, newDueDate);
  if (result.ok) revalidatePath(`/events/${eventId}`);
  return result;
}

export async function updateEventTaskNotesAction(taskId: string, eventId: string, notes: string): Promise<PlaybookActionResult> {
  const result = await updateEventTaskNotes(taskId, notes);
  if (result.ok) revalidatePath(`/events/${eventId}`);
  return result;
}

export async function updateEventTaskScheduleAction(taskId: string, eventId: string, input: ScheduleInput): Promise<PlaybookActionResult> {
  const result = await updateEventTaskSchedule(taskId, input);
  if (result.ok) { revalidatePath(`/events/${eventId}`); revalidatePath("/calendar"); }
  return result;
}

/**
 * Turns a Planning Task into a Request Framework record. One-click, no form:
 * defaults come straight from the task (title, description, due date,
 * assignee). Any refinement (type, description, visibility) happens on the
 * Request record itself — Planning creates and links, it does not duplicate
 * request editing (see docs for this integration).
 */
export async function createRequestForTaskAction(input: {
  taskId: string;
  eventId: string;
  clientId: string;
  title: string;
  description: string | null;
  dueDate: string;
  assignedToStaffId: string | null;
}): Promise<{ ok: true; requestId: string } | { ok: false; message?: string }> {
  const created = await createRequest({
    clientId: input.clientId,
    eventId: input.eventId,
    title: input.title,
    description: input.description ?? undefined,
    requestType: "task",
    // Shared by default — a task turned into a Request exists specifically
    // because it requires client participation (this integration's whole
    // purpose), so it should actually reach the Wedding Workspace's Request
    // Center rather than defaulting to the framework's venue_only default.
    visibility: "shared",
    dueDate: input.dueDate,
    assignedToStaffId: input.assignedToStaffId ?? undefined,
    sourceFeature: "planning",
    sourceId: input.taskId,
  });
  if (!created.ok) return { ok: false, message: created.error };

  const linked = await setEventTaskRequest(input.taskId, created.id);
  if (!linked.ok) return { ok: false, message: linked.message ?? "Could not link the request to this task." };

  revalidatePath(`/events/${input.eventId}`);
  return { ok: true, requestId: created.id };
}

export async function addEventTaskContextLinkAction(taskId: string, eventId: string, sourceType: EventTaskContextSourceType, sourceId: string, linkLabel?: string): Promise<PlaybookActionResult> {
  const result = await addEventTaskContextLink(taskId, sourceType, sourceId, linkLabel);
  if (result.ok) revalidatePath(`/events/${eventId}`);
  return result;
}

export async function removeEventTaskContextLinkAction(linkId: string, eventId: string): Promise<PlaybookActionResult> {
  const result = await removeEventTaskContextLink(linkId);
  if (result.ok) revalidatePath(`/events/${eventId}`);
  return result;
}

// ---- Template attachments (Definition time) ------------------------------------

export async function addPlaybookTaskAttachmentAction(
  templateId: string, playbookTaskId: string,
  attachment: { documentId: string } | { linkUrl: string; linkLabel: string | null },
  sortOrder: number,
): Promise<PlaybookActionResult> {
  const result = await addPlaybookTaskAttachment(playbookTaskId, attachment, sortOrder);
  if (result.ok) revalidatePath(`/library/playbooks/${templateId}`);
  return result;
}

export async function removePlaybookTaskAttachmentAction(attachmentId: string, templateId: string): Promise<PlaybookActionResult> {
  const result = await removePlaybookTaskAttachment(attachmentId);
  if (result.ok) revalidatePath(`/library/playbooks/${templateId}`);
  return result;
}

// ---- Milestones ---------------------------------------------------------------

export async function addMilestoneAction(templateId: string, name: string, sortOrder: number): Promise<PlaybookActionResult & { id?: string }> {
  const result = await addMilestone(templateId, name, sortOrder);
  if (result.ok) revalidatePath(`/library/playbooks/${templateId}`);
  return result;
}

export async function renameMilestoneAction(templateId: string, milestoneId: string, name: string): Promise<PlaybookActionResult> {
  const result = await renameMilestone(milestoneId, name);
  if (result.ok) revalidatePath(`/library/playbooks/${templateId}`);
  return result;
}

export async function reorderMilestoneAction(templateId: string, milestoneId: string, direction: "up" | "down"): Promise<PlaybookActionResult> {
  const result = await reorderMilestone(templateId, milestoneId, direction);
  if (result.ok) revalidatePath(`/library/playbooks/${templateId}`);
  return result;
}

export async function deleteMilestoneAction(templateId: string, milestoneId: string): Promise<PlaybookActionResult> {
  const result = await deleteMilestone(milestoneId);
  if (result.ok) revalidatePath(`/library/playbooks/${templateId}`);
  return result;
}
