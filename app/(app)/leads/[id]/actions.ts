"use server";

import { revalidatePath } from "next/cache";

import {
  addNote,
  addTask,
  deleteNote,
  deleteTask,
  setTaskCompleted,
  updateLeadInfo,
  updateLeadStatus,
  updateNote,
  updateRelationshipFields,
  updateTask,
} from "@/lib/leads/service";
import type {
  LeadActionResult,
  RelationshipInput,
  LeadInput,
  TaskInput,
} from "@/lib/leads/types";

function revalidateLead(leadId: string) {
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
}

export async function updateLeadStatusAction(
  leadId: string,
  status: string,
): Promise<LeadActionResult> {
  const result = await updateLeadStatus(leadId, status);
  if (result.ok) revalidateLead(leadId);
  return result;
}

export async function addNoteAction(
  leadId: string,
  body: string,
): Promise<LeadActionResult> {
  const result = await addNote(leadId, body);
  if (result.ok) revalidateLead(leadId);
  return result;
}

export async function updateNoteAction(
  noteId: string,
  leadId: string,
  body: string,
): Promise<LeadActionResult> {
  const result = await updateNote(noteId, leadId, body);
  if (result.ok) revalidateLead(leadId);
  return result;
}

export async function deleteNoteAction(
  noteId: string,
): Promise<LeadActionResult> {
  const result = await deleteNote(noteId);
  if (result.ok) revalidatePath("/leads", "layout");
  return result;
}

export async function addTaskAction(
  leadId: string,
  input: TaskInput,
): Promise<LeadActionResult> {
  const result = await addTask(leadId, input);
  if (result.ok) revalidateLead(leadId);
  return result;
}

export async function updateTaskAction(
  taskId: string,
  input: { title: string; dueDate: string },
): Promise<LeadActionResult> {
  return updateTask(taskId, input);
}

export async function setTaskCompletedAction(
  taskId: string,
  completed: boolean,
  leadId?: string,
  taskTitle?: string,
): Promise<LeadActionResult> {
  const result = await setTaskCompleted(taskId, completed, leadId, taskTitle);
  if (result.ok && leadId) revalidateLead(leadId);
  return result;
}

export async function deleteTaskAction(
  taskId: string,
): Promise<LeadActionResult> {
  return deleteTask(taskId);
}

export async function updateLeadInfoAction(
  leadId: string,
  input: LeadInput,
): Promise<LeadActionResult> {
  const result = await updateLeadInfo(leadId, input);
  if (result.ok) revalidateLead(leadId);
  return result;
}

export async function updateRelationshipAction(
  leadId: string,
  input: RelationshipInput,
  hints: { tourScheduled?: boolean; followUpSet?: boolean; contactedSet?: boolean },
): Promise<LeadActionResult> {
  const result = await updateRelationshipFields(leadId, input, hints);
  if (result.ok) revalidateLead(leadId);
  return result;
}
