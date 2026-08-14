"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import {
  addVenueNote,
  addVenueTask,
  completeVenueTask,
  markVenueContacted,
  recordViewAs,
  setEventOrderEnabled,
  setNextContact,
} from "@/lib/hq/crm-service";

export async function addVenueNoteAction(venueId: string, body: string): Promise<void> {
  await addVenueNote(venueId, body);
  revalidatePath(`/admin/venues/${venueId}`);
  revalidatePath(`/admin/onboarding/${venueId}`);
}

export async function addVenueTaskAction(
  venueId: string, title: string, dueDate: string | null,
  opts?: { kind?: "task" | "blocker"; engagementId?: string | null },
): Promise<void> {
  await addVenueTask(venueId, title, dueDate, opts);
  revalidatePath(`/admin/venues/${venueId}`);
  revalidatePath(`/admin/onboarding/${venueId}`);
}

export async function completeVenueTaskAction(venueId: string, taskId: string): Promise<void> {
  await completeVenueTask(taskId);
  revalidatePath(`/admin/venues/${venueId}`);
  revalidatePath(`/admin/onboarding/${venueId}`);
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

/** HQ-only: enable or disable Event Orders for one venue. Does not mutate Event Order rows. */
export async function setEventOrderEnabledAction(venueId: string, formData: FormData): Promise<void> {
  const enabled = String(formData.get("enabled") ?? "") === "true";
  const result = await setEventOrderEnabled(venueId, enabled);
  if (!result.ok) throw new Error(result.message);
  revalidatePath(`/admin/venues/${venueId}`);
}
