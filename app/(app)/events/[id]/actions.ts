"use server";

import { revalidatePath } from "next/cache";

import {
  addEventNote,
  addTeamMember,
  deleteEventNote_,
  removeTeamMember,
  updateEvent_,
  updateEventNote_,
  updateEventStatus_,
} from "@/lib/events/service";
import type { EventActionResult, EventInput, TeamMemberInput } from "@/lib/events/types";

function revalidateEvent(eventId: string) {
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/events");
}

export async function updateEventStatusAction(eventId: string, status: string): Promise<EventActionResult> {
  const result = await updateEventStatus_(eventId, status);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function updateEventAction(eventId: string, input: EventInput): Promise<EventActionResult> {
  const result = await updateEvent_(eventId, input);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function addEventNoteAction(eventId: string, body: string): Promise<EventActionResult> {
  const result = await addEventNote(eventId, body);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function updateEventNoteAction(noteId: string, eventId: string, body: string): Promise<EventActionResult> {
  const result = await updateEventNote_(noteId, eventId, body);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function deleteEventNoteAction(noteId: string): Promise<EventActionResult> {
  return deleteEventNote_(noteId);
}

export async function addTeamMemberAction(eventId: string, input: TeamMemberInput): Promise<EventActionResult> {
  const result = await addTeamMember(eventId, input);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function removeTeamMemberAction(memberId: string, memberName: string, eventId: string): Promise<EventActionResult> {
  const result = await removeTeamMember(memberId, memberName, eventId);
  if (result.ok) revalidateEvent(eventId);
  return result;
}
