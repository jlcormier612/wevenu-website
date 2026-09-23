"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  addNote,
  addTask,
  confirmPipelineBookedMove,
  deleteNote,
  deleteTask,
  markLeadLost,
  moveLeadBackToSalesPipeline,
  returnLeadToBooked,
  setTaskCompleted,
  setLeadPlannedEventSpace,
  updateLeadInfo,
  updateLeadPipelineStage,
  updateLeadStatus,
  updateNote,
  updateRelationshipFields,
  updateTask,
  wouldEnrollOnPipelineStageMove,
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
  previewRescheduleTourEmail,
  previewScheduleTourEmail,
  previewTourConfirmationRequestEmail,
  requestTourConfirmation,
  rescheduleTour,
  scheduleTourForLead,
  updateTourStatus,
} from "@/lib/tours/service";
import type { TourSendPreviewResult } from "@/lib/tours/service";
import type { CoordinatorTourResult, SimpleTourResult, TourSlot } from "@/lib/tours/types";

function revalidateLead(leadId: string) {
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath("/tasks");
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

export async function markLeadLostAction(
  leadId: string,
  input: { reason: string; detail?: string | null },
  stageKeyOrId?: string,
): Promise<LeadActionResult> {
  const result = await markLeadLost(leadId, input, stageKeyOrId);
  if (result.ok) {
    revalidateLead(leadId);
    void refreshLeadScore(leadId).catch(() => {});
  }
  return result;
}

export async function setLeadPlannedEventSpaceAction(
  leadId: string,
  spaceId: string | null,
): Promise<LeadActionResult> {
  const result = await setLeadPlannedEventSpace(leadId, spaceId);
  if (result.ok) revalidateLead(leadId);
  return result;
}

export async function confirmPipelineBookedMoveAction(
  leadId: string,
  stageKeyOrId: string,
  opts?: { spaceId?: string; selectionId?: string },
): Promise<
  | { ok: true; clientId: string; eventId: string | null; invitationSent: false; warning?: string; newlyBooked: boolean }
  | { ok: false; message: string }
> {
  const result = await confirmPipelineBookedMove(leadId, stageKeyOrId, opts);
  if (result.ok) {
    revalidateLead(leadId);
    revalidatePath("/clients");
    revalidatePath("/calendar");
    if (result.eventId) revalidatePath(`/events/${result.eventId}`);
    void refreshLeadScore(leadId).catch(() => {});
    // Caller responds to newlyBooked here. The celebration page consumes
    // the flag bookClient just wrote. Do not revalidate the client workspace
    // first — that page would skip the celebration if the flag were already gone.
    if (result.newlyBooked) {
      const qs = result.eventId ? `?eventId=${encodeURIComponent(result.eventId)}` : "";
      redirect(`/clients/${result.clientId}/booked${qs}`);
    }
  }
  return result;
}

export async function moveLeadBackToSalesPipelineAction(
  leadId: string,
): Promise<LeadActionResult> {
  const result = await moveLeadBackToSalesPipeline(leadId);
  if (result.ok) {
    revalidateLead(leadId);
    void refreshLeadScore(leadId).catch(() => {});
  }
  return result;
}

export async function returnLeadToBookedAction(
  leadId: string,
): Promise<LeadActionResult> {
  const result = await returnLeadToBooked(leadId);
  if (result.ok) {
    revalidateLead(leadId);
    revalidatePath(`/clients`);
    revalidatePath("/calendar");
    void refreshLeadScore(leadId).catch(() => {});
  }
  return result;
}

/** Preview before commit — does not move the lead or enroll anyone. */
export async function wouldEnrollOnPipelineStageMoveAction(
  leadId: string,
  stageId: string,
): Promise<
  | {
      ok: true;
      wouldEnroll: boolean;
      preview: import("@/lib/message-sequences/confirm-preview").AutomationMessagePreview | null;
    }
  | { ok: false; message: string }
> {
  return wouldEnrollOnPipelineStageMove(leadId, stageId);
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
  input: { title: string; dueDate: string; assignedToStaffId?: string | null },
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

/** Send Confirmation Request — distinct from Mark as Confirmed (updateTourStatusAction above). Never changes status by itself. */
export async function requestTourConfirmationAction(appointmentId: string, leadId: string): Promise<SimpleTourResult> {
  const result = await requestTourConfirmation(appointmentId);
  if (result.ok) revalidateLead(leadId);
  return result;
}

export async function previewScheduleTourEmailAction(leadId: string, slotStart: string): Promise<TourSendPreviewResult> {
  return previewScheduleTourEmail(leadId, slotStart);
}

export async function previewRescheduleTourEmailAction(appointmentId: string, slotStart: string): Promise<TourSendPreviewResult> {
  return previewRescheduleTourEmail(appointmentId, slotStart);
}

export async function previewTourConfirmationRequestAction(appointmentId: string): Promise<TourSendPreviewResult> {
  return previewTourConfirmationRequestEmail(appointmentId);
}

export async function requestSmsConsentAction(leadId: string) {
  const { requestSmsConsentForLead } = await import("@/lib/communication/request-sms-consent");
  const result = await requestSmsConsentForLead(leadId);
  if (result.ok) revalidateLead(leadId);
  return result;
}

export async function previewDeleteLeadAction(leadId: string) {
  const { previewDeleteLead } = await import("@/lib/records/delete-record");
  return previewDeleteLead(leadId);
}

export async function deleteLeadRecordAction(leadId: string) {
  const { deleteLeadRecord } = await import("@/lib/records/delete-record");
  const result = await deleteLeadRecord(leadId);
  if (result.ok) {
    revalidatePath("/leads");
    revalidatePath("/reporting");
    revalidatePath("/reporting/sales");
    revalidatePath("/reporting/bookings");
  }
  return result;
}

export async function keepDuplicateSeparateAction(leadId: string) {
  const { keepDuplicateSeparate } = await import("@/lib/leads/duplicate-review");
  const result = await keepDuplicateSeparate(leadId);
  if (result.ok) {
    revalidatePath(`/leads/${leadId}`);
    revalidatePath("/leads");
  }
  return result;
}
