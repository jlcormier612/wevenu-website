/**
 * Vendor application service. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import * as repo from "@/lib/vendors/repository";
import { requireAdminUser } from "@/lib/hq/crm-service";
import type {
  CreateVendorResult,
  EventVendorAssignment,
  Vendor,
  VendorActionResult,
  VendorAssignmentInput,
  VendorInput,
  VendorReview,
  VendorReviewInput,
  VendorWithEvents,
} from "@/lib/vendors/types";
import {
  validateAssignmentInput,
  validateVendorInput,
} from "@/lib/vendors/validation";
import { getCurrentVenue } from "@/lib/venue/service";
import { autoInviteVendorIfUnclaimed } from "@/lib/vendor-invites/service";
import {
  clearAssignmentBooked,
  markAssignmentBooked,
} from "@/lib/vendor-availability/sync";

async function withVenue<T>(
  fn: (supabase: Awaited<ReturnType<typeof createClient>>, venueId: string) => Promise<T>,
): Promise<T | VendorActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expired." };
  return fn(supabase, venue.id);
}

// ---- read -------------------------------------------------------------------

export async function getVendors(): Promise<Vendor[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getVendors(await createClient(), venue.id);
}

export async function getVendor(vendorId: string): Promise<VendorWithEvents | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return repo.getVendor(await createClient(), venue.id, vendorId);
}

export async function getEventVendorAssignments(eventId: string): Promise<EventVendorAssignment[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getEventVendorAssignments(await createClient(), venue.id, eventId);
}

// ---- vendor CRUD ------------------------------------------------------------

/** Migration Center — mirrors lib/leads/service.ts's findActiveDuplicateLead(). */
export async function findActiveDuplicateVendor(businessName: string, email: string): Promise<{ id: string } | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  return repo.findActiveDuplicateVendor(supabase, venue.id, businessName, email);
}

/** White-Glove Migration (Hospitality Success Platform §2.2a step 4) — see createClientForVenue's doc comment for the pattern this mirrors. */
export async function findActiveDuplicateVendorForVenue(venueId: string, businessName: string, email: string): Promise<{ id: string } | null> {
  if (!isSupabaseConfigured) return null;
  const actor = await requireAdminUser();
  if (!actor) return null;
  return repo.findActiveDuplicateVendor(createAdminClient(), venueId, businessName, email);
}

export async function createVendor(input: VendorInput): Promise<CreateVendorResult> {
  const errors = validateVendorInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const result = await withVenue(async (supabase, venueId) => {
    const vendorId = await repo.insertVendor(supabase, venueId, input);
    return { ok: true, vendorId } as CreateVendorResult;
  });
  return result as CreateVendorResult;
}

/** White-Glove Migration (Hospitality Success Platform §2.2a step 4) — see createClientForVenue's doc comment for the pattern this mirrors. */
export async function createVendorForVenue(venueId: string, input: VendorInput): Promise<CreateVendorResult> {
  const actor = await requireAdminUser();
  if (!actor) return { ok: false, message: "Not signed in as an HQ admin." };
  const errors = validateVendorInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const admin = createAdminClient();
  const vendorId = await repo.insertVendor(admin, venueId, input);
  return { ok: true, vendorId };
}

export async function updateVendor_(vendorId: string, input: VendorInput): Promise<VendorActionResult> {
  const errors = validateVendorInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const result = await withVenue(async (supabase, venueId) => {
    const { identityUpdated } = await repo.updateVendor(supabase, venueId, vendorId, input);
    return {
      ok: true,
      message: identityUpdated ? undefined : "Saved your notes and pricing flag. This vendor has claimed their profile, so their business details are managed by their own account.",
    } as VendorActionResult;
  });
  return result as VendorActionResult;
}

export async function deleteVendor_(vendorId: string): Promise<VendorActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.deleteVendor(supabase, venueId, vendorId);
    return { ok: true } as VendorActionResult;
  });
  return result as VendorActionResult;
}

export async function reactivateVendor_(vendorId: string): Promise<VendorActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.reactivateVendor(supabase, venueId, vendorId);
    return { ok: true } as VendorActionResult;
  });
  return result as VendorActionResult;
}

// ---- reviews ------------------------------------------------------------------

export async function getVendorReviews(vendorId: string): Promise<VendorReview[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getVendorReviews(await createClient(), venue.id, vendorId);
}

export async function addVendorReview(vendorId: string, input: VendorReviewInput): Promise<VendorActionResult> {
  if (input.rating < 1 || input.rating > 5) return { ok: false, message: "Rating must be between 1 and 5." };
  const result = await withVenue(async (supabase, venueId) => {
    await repo.insertVendorReview(supabase, venueId, vendorId, input);
    return { ok: true } as VendorActionResult;
  });
  return result as VendorActionResult;
}

// ---- event vendor assignments -----------------------------------------------

/**
 * Vendor Workspace Realignment, Phase 3 (2026-07-22) — Stage 3 (Booked)
 * automation: "when a vendor is selected, automatically ... invite vendor
 * into Hello to Cheers." Booking a vendor with no portal login would
 * otherwise leave them unable to see the assignment, tasks, or timeline
 * until a coordinator remembered the separate manual invite step.
 * Best-effort — never blocks or fails the booking itself.
 */
export async function assignVendor(
  eventId: string, input: VendorAssignmentInput,
): Promise<{ ok: true; assignment: EventVendorAssignment } | VendorActionResult> {
  const errors = validateAssignmentInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors, message: errors.vendorId };
  const result = await withVenue(async (supabase, venueId) => {
    const assignment = await repo.insertVendorAssignment(supabase, venueId, eventId, input);
    // Availability write-through: secured assignment → Booked on event_date.
    const { data: event } = await supabase
      .from("events")
      .select("event_date, name, status")
      .eq("id", eventId)
      .maybeSingle<{ event_date: string | null; name: string; status: string }>();
    if (event) {
      await markAssignmentBooked({
        assignmentId: assignment.id,
        vendorId:     assignment.vendorId,
        eventDate:    event.event_date,
        eventName:    event.name,
        eventStatus:  event.status,
      });
    }
    return { ok: true, assignment };
  });
  if ((result as VendorActionResult).ok) {
    const venue = await getCurrentVenue();
    if (venue) void autoInviteVendorIfUnclaimed(venue.id, venue.name, input.vendorId);
  }
  return result as { ok: true; assignment: EventVendorAssignment } | VendorActionResult;
}

export async function removeVendorAssignment(assignmentId: string): Promise<VendorActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.deleteVendorAssignment(supabase, venueId, assignmentId);
    // Free the Booked day if this assignment was the occupant (manual blocks stay).
    await clearAssignmentBooked(assignmentId);
    return { ok: true } as VendorActionResult;
  });
  return result as VendorActionResult;
}

export async function updateVendorAssignment_(
  assignmentId: string,
  input: { arrivalTime: string; setupLocation: string; loadInNotes: string; notes: string },
): Promise<VendorActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.updateVendorAssignment(supabase, venueId, assignmentId, input);
    return { ok: true } as VendorActionResult;
  });
  return result as VendorActionResult;
}

/** Sprint 2 — Vendor Payment Visibility: "what am I being paid, has it been paid." */
export async function setVendorAssignmentPayment_(
  assignmentId: string,
  agreedFee: number | null,
  paymentStatus: "pending" | "paid",
): Promise<VendorActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.setVendorAssignmentPayment(supabase, venueId, assignmentId, agreedFee, paymentStatus);
    return { ok: true } as VendorActionResult;
  });
  return result as VendorActionResult;
}
