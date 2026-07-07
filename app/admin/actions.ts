"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import {
  addVenueNote,
  addVenueTask,
  completeVenueTask,
  markVenueContacted,
  recordViewAs,
  setNextContact,
} from "@/lib/hq/crm-service";

export async function addVenueNoteAction(venueId: string, body: string): Promise<void> {
  await addVenueNote(venueId, body);
  revalidatePath(`/admin/venues/${venueId}`);
}

export async function addVenueTaskAction(venueId: string, title: string, dueDate: string | null): Promise<void> {
  await addVenueTask(venueId, title, dueDate);
  revalidatePath(`/admin/venues/${venueId}`);
}

export async function completeVenueTaskAction(venueId: string, taskId: string): Promise<void> {
  await completeVenueTask(taskId);
  revalidatePath(`/admin/venues/${venueId}`);
}

export async function setNextContactAction(venueId: string, nextContactAt: string | null): Promise<void> {
  await setNextContact(venueId, nextContactAt);
  revalidatePath(`/admin/venues/${venueId}`);
  revalidatePath("/admin");
}

export async function markVenueContactedAction(venueId: string): Promise<void> {
  await markVenueContacted(venueId);
  revalidatePath(`/admin/venues/${venueId}`);
}

/** Logs the View-As audit event, then sends the admin to the read-only snapshot. */
export async function startViewAsAction(venueId: string): Promise<void> {
  await recordViewAs(venueId);
  redirect(`/admin/venues/${venueId}/view-as`);
}
