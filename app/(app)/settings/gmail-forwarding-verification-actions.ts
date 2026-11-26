"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/integrations/supabase/admin";
import {
  acknowledgeGmailVerification,
  dismissGmailVerification,
} from "@/lib/lead-intake/gmail-forwarding-verification-store";
import { getCurrentUserRole, getCurrentVenue } from "@/lib/venue/service";

async function requireOwnerManagerVenue() {
  const venue = await getCurrentVenue();
  const role = await getCurrentUserRole();
  if (!venue || (role !== "owner" && role !== "manager")) {
    return null;
  }
  return venue;
}

export async function acknowledgeGmailForwardingVerificationAction(id: string): Promise<{ ok: boolean }> {
  const venue = await requireOwnerManagerVenue();
  if (!venue) return { ok: false };
  const admin = createAdminClient();
  const ok = await acknowledgeGmailVerification(admin, venue.id, id);
  if (ok) revalidatePath("/settings/leads");
  return { ok };
}

export async function dismissGmailForwardingVerificationAction(id: string): Promise<{ ok: boolean }> {
  const venue = await requireOwnerManagerVenue();
  if (!venue) return { ok: false };
  const admin = createAdminClient();
  const ok = await dismissGmailVerification(admin, venue.id, id);
  if (ok) revalidatePath("/settings/leads");
  return { ok };
}
