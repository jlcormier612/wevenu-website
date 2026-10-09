"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { saveLeadSpacePreferences } from "@/lib/leads/space-preferences-service";
import type { LeadSpacePreferenceInput } from "@/lib/leads/space-preferences";
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
  completeFollowUp,
  updateRelationshipFields,
  updateTask,
  wouldEnrollOnPipelineStageMove,
} from "@/lib/leads/service";
import type { FollowUpCompletionInput } from "@/lib/leads/follow-up-completion";
import { refreshLeadScore } from "@/lib/leads/scores";
import {
  loadBookingConfirmationDraft,
  loadBookingConfirmationDraftForClient,
} from "@/lib/booking-journey/confirmation-draft-load";
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
  getLeadPublicTourSchedulingUrl,
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
  customerMessages?: "send" | "skip",
): Promise<LeadActionResult> {
  const result = await updateLeadStatus(leadId, status, customerMessages ? { customerMessages } : undefined);
  if (result.ok) {
    revalidateLead(leadId);
    void refreshLeadScore(leadId).catch(() => {}); // immediate score refresh on status change
  }
  return result;
}

export async function updateLeadPipelineStageAction(
  leadId: string,
  stageId: string,
  customerMessages?: "send" | "skip",
): Promise<LeadActionResult> {
  const result = await updateLeadPipelineStage(leadId, stageId, customerMessages ? { customerMessages } : undefined);
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

export async function saveLeadSpacePreferencesAction(
  leadId: string,
  inputs: LeadSpacePreferenceInput[],
): Promise<LeadActionResult> {
  const result = await saveLeadSpacePreferences(leadId, inputs);
  if (result.ok) revalidateLead(leadId);
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
  opts?: {
    spaceId?: string;
    selectionId?: string;
    occupancy?: import("@/lib/booking-journey/confirmed-occupancy").ConfirmedBookingOccupancy;
  },
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
  occupancy?: import("@/lib/booking-journey/confirmed-occupancy").ConfirmedBookingOccupancy,
): Promise<
  | { ok: true; clientId: string; eventId: string | null; newlyBooked: boolean }
  | { ok: false; message: string }
> {
  const result = await returnLeadToBooked(leadId, occupancy);
  if (result.ok) {
    revalidateLead(leadId);
    revalidatePath(`/clients`);
    revalidatePath("/calendar");
    if (result.eventId) revalidatePath(`/events/${result.eventId}`);
    void refreshLeadScore(leadId).catch(() => {});
  }
  return result;
}

export async function getBookingConfirmationDraftAction(leadId: string) {
  return loadBookingConfirmationDraft(leadId);
}

export async function getBookingConfirmationDraftForClientAction(clientId: string) {
  return loadBookingConfirmationDraftForClient(clientId);
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
      plan: import("@/lib/message-sequences/confirm-preview").StageChangeMessagePlan | null;
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
    // Tour schedule OR completion is a commitment milestone — refresh scores
    // immediately so completed-tour credit (+15) is not left stale.
    // Does not run post-tour automation / thank-you sequences.
    if (hints.tourScheduled || input.tourCompleted) {
      void refreshLeadScore(leadId).catch(() => {});
    }
  }
  return result;
}

export async function completeFollowUpAction(
  leadId: string,
  input: FollowUpCompletionInput,
): Promise<LeadActionResult> {
  const result = await completeFollowUp(leadId, input);
  if (result.ok) {
    revalidateLead(leadId);
    revalidatePath("/dashboard");
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

export async function getLeadPublicTourSchedulingUrlAction(leadId: string): Promise<string | null> {
  try {
    return await getLeadPublicTourSchedulingUrl(leadId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("TOUR_ORIGIN_SIGNING_SECRET")) {
      console.error("TOUR_ORIGIN_SIGNING_SECRET is not configured.");
      return null;
    }
    throw err;
  }
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
  options?: { actualDate?: string; actualTime?: string },
): Promise<SimpleTourResult> {
  const result = await updateTourStatus(appointmentId, status, reason, options);
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

/** Email-based SMS consent request — does not grant consent until they opt in on the token page. */
export async function requestSmsConsentEmailAction(leadId: string) {
  const { requestSmsConsentEmailForLead } = await import("@/lib/communication/sms-consent-email");
  const result = await requestSmsConsentEmailForLead(leadId);
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
    revalidatePath("/dashboard");
    revalidatePath("/tours");
    revalidatePath("/reporting");
    revalidatePath("/reporting/sales");
    revalidatePath("/reporting/bookings");
  }
  return result;
}

/** Relationship-level Archive — not Delete. History remains. */
export async function archiveLeadRelationshipAction(leadId: string) {
  const { archiveRelationship } = await import("@/lib/relationships/archive");
  const result = await archiveRelationship({ leadId });
  if (result.ok) {
    revalidatePath("/leads");
    revalidatePath(`/leads/${leadId}`);
    revalidatePath("/clients");
    revalidatePath("/dashboard");
    revalidatePath("/payments");
    revalidatePath("/tasks");
  }
  return result;
}

export async function restoreLeadRelationshipAction(leadId: string) {
  const { restoreRelationship } = await import("@/lib/relationships/archive");
  const result = await restoreRelationship({ leadId });
  if (result.ok) {
    revalidatePath("/leads");
    revalidatePath(`/leads/${leadId}`);
    revalidatePath("/clients");
    revalidatePath("/dashboard");
    revalidatePath("/payments");
    revalidatePath("/tasks");
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
