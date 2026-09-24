/**
 * Initial setup: purchaser/setup person vs venue Owner.
 * Reuses venue_enrollments.purchaser_is_owner + venue_staff.is_owner.
 * Does not invent a second ownership model.
 */

import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import type { AccessTitle } from "@/lib/authorization/types";

export type EnrollmentOwnershipRow = {
  id: string;
  owner_email: string | null;
  owner_first_name: string | null;
  owner_last_name: string | null;
  purchaser_is_owner: boolean | null;
};

export type SetupPersonIdentity = {
  name: string;
  email: string;
};

export function setupPersonDisplayName(row: {
  owner_first_name?: string | null;
  owner_last_name?: string | null;
  fallbackName?: string | null;
  fallbackEmail?: string | null;
}): string {
  const parts = [row.owner_first_name, row.owner_last_name].filter(Boolean);
  if (parts.length > 0) return parts.join(" ").trim();
  const fallback = row.fallbackName?.trim();
  if (fallback) return fallback;
  return row.fallbackEmail?.trim() || "You";
}

export function emailsMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export async function getEnrollmentOwnershipForVenue(
  venueId: string,
): Promise<EnrollmentOwnershipRow | null> {
  if (!isSupabaseConfigured) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("venue_enrollments")
    .select("id, owner_email, owner_first_name, owner_last_name, purchaser_is_owner")
    .eq("venue_id", venueId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<EnrollmentOwnershipRow>();
  return data ?? null;
}

export function isPurchaserSetupPerson(
  enrollment: EnrollmentOwnershipRow | null,
  actorEmail: string | null | undefined,
): boolean {
  if (!enrollment) return false;
  return emailsMatch(enrollment.owner_email, actorEmail);
}

/**
 * Setup Administrator (purchaser who said they are not an Owner) may
 * record/invite owners. Does not make add-owner a general Administrator cap.
 */
export function canSetupPurchaserEstablishOwners(input: {
  isOwner: boolean;
  isActive: boolean;
  accessTitle: AccessTitle | string;
  actorEmail: string | null | undefined;
  enrollment: EnrollmentOwnershipRow | null;
}): boolean {
  if (!input.isActive) return false;
  if (input.isOwner) return true;
  if (input.enrollment?.purchaser_is_owner !== false) return false;
  if (input.accessTitle !== "administrator") return false;
  return isPurchaserSetupPerson(input.enrollment, input.actorEmail);
}

export function needsPurchaserOwnershipQuestion(input: {
  actorEmail: string | null | undefined;
  enrollment: EnrollmentOwnershipRow | null;
  actorIsOwner: boolean;
}): boolean {
  if (!input.enrollment) return false;
  if (!isPurchaserSetupPerson(input.enrollment, input.actorEmail)) return false;
  if (input.enrollment.purchaser_is_owner !== null) return false;
  if (input.actorIsOwner) return false;
  return true;
}

export function needsInitialOwnerRecords(input: {
  purchaserIsOwner: boolean | null;
  ownerCount: number;
}): boolean {
  return input.purchaserIsOwner === false && input.ownerCount === 0;
}

export function needsInitialOwnershipStep(input: {
  actorEmail: string | null | undefined;
  enrollment: EnrollmentOwnershipRow | null;
  actorIsOwner: boolean;
  ownerCount: number;
}): boolean {
  if (needsPurchaserOwnershipQuestion(input)) return true;
  if (!input.enrollment) return false;
  if (!isPurchaserSetupPerson(input.enrollment, input.actorEmail)) return false;
  return needsInitialOwnerRecords({
    purchaserIsOwner: input.enrollment.purchaser_is_owner,
    ownerCount: input.ownerCount,
  });
}
