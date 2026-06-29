"use server";

import { revalidatePath } from "next/cache";
import {
  addTemplateTask, applyPlaybookToEvent, completeEventTask_,
  createTemplate, deleteTemplate_, deleteTemplateTask_,
  seedDefaultWeddingTemplate, setEventTaskStatus, updateTemplateTask_,
} from "@/lib/playbooks/service";
import type { PlaybookActionResult, PlaybookTask, CreatePlaybookResult } from "@/lib/playbooks/types";

export async function createTemplateAction(name: string, eventType: string | null, description: string | null): Promise<CreatePlaybookResult> {
  const result = await createTemplate(name, eventType, description);
  if (result.ok) revalidatePath("/library/playbooks");
  return result;
}

export async function deleteTemplateAction(id: string): Promise<PlaybookActionResult> {
  const result = await deleteTemplate_(id);
  if (result.ok) revalidatePath("/library/playbooks");
  return result;
}

export async function addTemplateTaskAction(templateId: string, task: Omit<PlaybookTask, "id" | "templateId" | "venueId" | "createdAt">): Promise<PlaybookActionResult> {
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

export async function seedDefaultTemplateAction(): Promise<PlaybookActionResult> {
  const result = await seedDefaultWeddingTemplate();
  if (result.ok) revalidatePath("/library/playbooks");
  return result;
}
