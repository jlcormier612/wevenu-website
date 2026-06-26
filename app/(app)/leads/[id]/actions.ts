"use server";

import { revalidatePath } from "next/cache";

import {
  addNote,
  addTask,
  deleteNote,
  deleteTask,
  setTaskCompleted,
  updateLeadStatus,
} from "@/lib/leads/service";
import type { LeadActionResult, TaskInput } from "@/lib/leads/types";

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

export async function setTaskCompletedAction(
  taskId: string,
  completed: boolean,
): Promise<LeadActionResult> {
  return setTaskCompleted(taskId, completed);
}

export async function deleteTaskAction(
  taskId: string,
): Promise<LeadActionResult> {
  return deleteTask(taskId);
}
