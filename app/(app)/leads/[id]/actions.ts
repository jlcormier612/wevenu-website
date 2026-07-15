"use server";

import { revalidatePath } from "next/cache";

import {
  addNote,
  addTask,
  deleteNote,
  deleteTask,
  setTaskCompleted,
  updateLeadInfo,
  updateLeadPipelineStage,
  updateLeadStatus,
  updateNote,
  updateRelationshipFields,
  updateTask,
} from "@/lib/leads/service";
import { refreshLeadScore } from "@/lib/leads/scores";
import type {
  LeadActionResult,
  RelationshipInput,
  LeadInput,
  TaskInput,
} from "@/lib/leads/types";
import {
  getCoordinatorTourSlots,
  rescheduleTour,
  scheduleTourForLead,
  updateTourStatus,
} from "@/lib/tours/service";
import type { CoordinatorTourResult, SimpleTourResult, TourSlot } from "@/lib/tours/types";

function revalidateLead(leadId: string) {
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
}

export async function updateLeadStatusAction(
  leadId: string,
  status: string,
): Promise<LeadActionResult> {
  const result = await updateLeadStatus(leadId, status);
  if (result.ok) {
    revalidateLead(leadId);
    void refreshLeadScore(leadId).catch(() => {}); // immediate score refresh on status change
  }
  return result;
}

export async function updateLeadPipelineStageAction(
  leadId: string,
  stageId: string,
): Promise<LeadActionResult> {
  const result = await updateLeadPipelineStage(leadId, stageId);
  if (result.ok) {
    revalidateLead(leadId);
    void refreshLeadScore(leadId).catch(() => {}); // same as status changes — the underlying status did change
  }
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
  if (result.ok) {
    revalidateLead(leadId);
    // Tour scheduling is a commitment milestone — refresh scores immediately
    if (hints.tourScheduled) void refreshLeadScore(leadId).catch(() => {});
  }
  return result;
}

// ── Coordinator Tour Scheduling ────────────────────────────────────────────────
//
// "Open Lead → Schedule Tour → choose an available slot → Save → Done."
// Everything downstream (Calendar, confirmation email, notification,
// automation, Luv) already happens on its own once tour_appointments has a
// real row — see lib/tours/service.ts and lib/tours/communication.ts.
// These actions only ever call into that one engine, never touch
// tour_appointments directly.

export async function getCoordinatorTourSlotsAction(startDate: string, endDate: string): Promise<TourSlot[]> {
  return getCoordinatorTourSlots(startDate, endDate);
}

export async function scheduleTourAction(leadId: string, slotStart: string, notes?: string): Promise<CoordinatorTourResult> {
  const result = await scheduleTourForLead(leadId, slotStart, notes);
  if (result.ok) {
    revalidateLead(leadId);
    void refreshLeadScore(leadId).catch(() => {});
  }
  return result;
}

export async function rescheduleTourAction(appointmentId: string, leadId: string, newSlotStart: string): Promise<CoordinatorTourResult> {
  const result = await rescheduleTour(appointmentId, newSlotStart);
  if (result.ok) revalidateLead(leadId);
  return result;
}

export async function updateTourStatusAction(
  appointmentId: string,
  leadId: string,
  status: "confirmed" | "completed" | "cancelled" | "no_show",
  reason?: string,
): Promise<SimpleTourResult> {
  const result = await updateTourStatus(appointmentId, status, reason);
  if (result.ok) revalidateLead(leadId);
  return result;
}
