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
import {
  clearAssignmentBooked,
  markAssignmentBooked,
} from "@/lib/vendor-availability/sync";
import { notifyVendorOfEventAssignment } from "@/lib/vendors/notify-assignment";
import { notifyVendorOfEventRemoval } from "@/lib/vendors/notify-removal";
import { approvePendingRequestsForAssignment } from "@/lib/vendor-removal-requests/service";

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
  const supabase = await createClient();
  const assignments = await repo.getEventVendorAssignments(supabase, venue.id, eventId);
  if (assignments.length === 0) return assignments;

  const { getPendingRemovalRequestsForEvent } = await import("@/lib/vendor-removal-requests/service");
  const pending = await getPendingRemovalRequestsForEvent(eventId);
  if (pending.length === 0) return assignments;

  const byAssignment = new Map<string, typeof pending>();
  for (const req of pending) {
    if (!req.assignmentId) continue;
    const list = byAssignment.get(req.assignmentId) ?? [];
    list.push(req);
    byAssignment.set(req.assignmentId, list);
  }
  return assignments.map((a) => ({
    ...a,
    pendingRemovalRequests: byAssignment.get(a.id) ?? [],
  }));
}

export async function getClientVendorAssignments(clientId: string): Promise<EventVendorAssignment[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getClientVendorAssignments(await createClient(), venue.id, clientId);
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

export async function listImportVendorRecords() {
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return listImportVendorRecordsWithClient(await createClient(), venue.id);
}

export async function listImportVendorRecordsForVenue(venueId: string) {
  const actor = await requireAdminUser();
  if (!actor) return [];
  return listImportVendorRecordsWithClient(createAdminClient(), venueId);
}

async function listImportVendorRecordsWithClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  venueId: string,
) {
  const { sourceVendorIdFromData, importFingerprintFromData } = await import("@/lib/import/vendor-match");
  const relatedQuery = await supabase
    .from("venue_vendor_relationships")
    .select("id, vendor_id, status, source_data, vendors!inner(id, business_name, email, phone, website_url, contact_name, is_claimed)")
    .eq("venue_id", venueId)
    .neq("status", "removed");
  const related = relatedQuery.error
    ? (await supabase
      .from("venue_vendor_relationships")
      .select("id, vendor_id, status, vendors!inner(id, business_name, email, phone, website_url, contact_name, is_claimed)")
      .eq("venue_id", venueId)
      .neq("status", "removed")).data
    : relatedQuery.data;
  const venueRows = ((related ?? []) as Array<{
    id: string;
    vendor_id: string;
    source_data?: Record<string, unknown> | null;
    vendors: {
      id: string;
      business_name: string;
      email: string | null;
      phone: string | null;
      website_url: string | null;
      contact_name: string | null;
      is_claimed: boolean;
    } | Array<{
      id: string;
      business_name: string;
      email: string | null;
      phone: string | null;
      website_url: string | null;
      contact_name: string | null;
      is_claimed: boolean;
    }>;
  }>).flatMap((row) => {
    const vendor = Array.isArray(row.vendors) ? row.vendors[0] : row.vendors;
    if (!vendor) return [];
    return [{
      vendorId: vendor.id,
      relationshipId: row.id,
      connectedToThisVenue: true,
      businessName: vendor.business_name,
      email: vendor.email,
      phone: vendor.phone,
      websiteUrl: vendor.website_url,
      contactName: vendor.contact_name,
      isClaimed: vendor.is_claimed,
      sourceVendorId: sourceVendorIdFromData(row.source_data),
      importFingerprint: importFingerprintFromData(row.source_data),
    }];
  });
  return venueRows;
}

export async function findGlobalVendorImportCandidates(
  emails: string[],
  names: string[],
  alreadyConnectedVendorIds: Set<string>,
  venueId?: string,
) {
  if (venueId) {
    const actor = await requireAdminUser();
    if (!actor) return [];
  }
  const supabase = venueId ? createAdminClient() : await createClient();
  const { sourceVendorIdFromData, importFingerprintFromData } = await import("@/lib/import/vendor-match");
  void sourceVendorIdFromData;
  void importFingerprintFromData;
  const trimmedEmails = [...new Set(emails.map((value) => value.trim()).filter(Boolean))];
  const trimmedNames = [...new Set(names.map((value) => value.trim()).filter(Boolean))];
  const found: Array<{
    vendorId: string;
    relationshipId: null;
    connectedToThisVenue: false;
    businessName: string;
    email: string | null;
    phone: string | null;
    websiteUrl: string | null;
    contactName: string | null;
    isClaimed: boolean;
    sourceVendorId: null;
    importFingerprint: null;
  }> = [];
  const seen = new Set(alreadyConnectedVendorIds);
  if (trimmedEmails.length > 0) {
    const { data } = await supabase.from("vendors")
      .select("id, business_name, email, phone, website_url, contact_name, is_claimed")
      .in("email", trimmedEmails)
      .limit(40);
    for (const row of data ?? []) {
      const r = row as {
        id: string;
        business_name: string;
        email: string | null;
        phone: string | null;
        website_url: string | null;
        contact_name: string | null;
        is_claimed: boolean;
      };
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      found.push({
        vendorId: r.id,
        relationshipId: null,
        connectedToThisVenue: false,
        businessName: r.business_name,
        email: r.email,
        phone: r.phone,
        websiteUrl: r.website_url,
        contactName: r.contact_name,
        isClaimed: r.is_claimed,
        sourceVendorId: null,
        importFingerprint: null,
      });
    }
  }
  if (trimmedNames.length > 0) {
    const { data } = await supabase.from("vendors")
      .select("id, business_name, email, phone, website_url, contact_name, is_claimed")
      .in("business_name", trimmedNames)
      .limit(40);
    for (const row of data ?? []) {
      const r = row as {
        id: string;
        business_name: string;
        email: string | null;
        phone: string | null;
        website_url: string | null;
        contact_name: string | null;
        is_claimed: boolean;
      };
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      found.push({
        vendorId: r.id,
        relationshipId: null,
        connectedToThisVenue: false,
        businessName: r.business_name,
        email: r.email,
        phone: r.phone,
        websiteUrl: r.website_url,
        contactName: r.contact_name,
        isClaimed: r.is_claimed,
        sourceVendorId: null,
        importFingerprint: null,
      });
    }
  }
  return found;
}

export async function createVendor(
  input: VendorInput,
  confirmed?: repo.ConfirmedVendorImportDecision,
): Promise<CreateVendorResult> {
  const errors = validateVendorInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const result = await withVenue(async (supabase, venueId) => {
    const created = await repo.resolveOrCreateVendor(supabase, venueId, input, confirmed);
    await stampVendorImportSourceData(supabase, created.relationshipId, input);
    return { ok: true, vendorId: created.vendorId } as CreateVendorResult;
  });
  return result as CreateVendorResult;
}

/** White-Glove Migration (Hospitality Success Platform §2.2a step 4) — see createClientForVenue's doc comment for the pattern this mirrors. */
export async function createVendorForVenue(
  venueId: string,
  input: VendorInput,
  confirmed?: repo.ConfirmedVendorImportDecision,
): Promise<CreateVendorResult> {
  const actor = await requireAdminUser();
  if (!actor) return { ok: false, message: "Not signed in as an HQ admin." };
  const errors = validateVendorInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const admin = createAdminClient();
  const created = await repo.resolveOrCreateVendor(admin, venueId, input, confirmed);
  await stampVendorImportSourceData(admin, created.relationshipId, input);
  return { ok: true, vendorId: created.vendorId };
}

async function stampVendorImportSourceData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  relationshipId: string | null,
  input: VendorInput,
): Promise<void> {
  if (!relationshipId) return;
  const { vendorSourceData } = await import("@/lib/import/vendor-match");
  const stamped = await supabase.from("venue_vendor_relationships")
    .update({ source_data: vendorSourceData({
      businessName: input.businessName,
      email: input.email,
      phone: input.phone,
      websiteUrl: input.websiteUrl,
      contactName: input.contactName,
      category: input.category,
      notes: input.notes,
      sourceVendorId: input.sourceVendorId,
    }) })
    .eq("id", relationshipId);
  if (stamped.error) console.error("Vendor import source_data stamp failed:", stamped.error.message);
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
 * Venue Assign — creates event_vendor_assignments (conversation trigger
 * provisions venue↔vendor thread). Notifies the vendor by email; unclaimed
 * vendors get a claim deep-link + invitation row (same notify path as
 * couple Submit). Best-effort notify — never blocks the booking itself.
 */
export async function assignVendor(
  eventId: string, input: VendorAssignmentInput,
): Promise<{ ok: true; assignment: EventVendorAssignment } | VendorActionResult> {
  const errors = validateAssignmentInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors, message: errors.vendorId };
  let created = false;
  const result = await withVenue(async (supabase, venueId) => {
    const inserted = await repo.insertVendorAssignment(supabase, venueId, eventId, input);
    created = inserted.created;
    const assignment = inserted.assignment;
    // Availability write-through: secured assignment → Booked on every day in range.
    const { data: event } = await supabase
      .from("events")
      .select("event_date, event_end_date, name, status")
      .eq("id", eventId)
      .maybeSingle<{
        event_date: string | null;
        event_end_date: string | null;
        name: string;
        status: string;
      }>();
    if (event) {
      await markAssignmentBooked({
        assignmentId: assignment.id,
        vendorId:     assignment.vendorId,
        eventDate:    event.event_date,
        eventEndDate: event.event_end_date,
        eventName:    event.name,
        eventStatus:  event.status,
      });
    }
    return { ok: true, assignment };
  });
  if ((result as { ok: true; assignment: EventVendorAssignment }).ok && created) {
    const venue = await getCurrentVenue();
    const assignment = (result as { ok: true; assignment: EventVendorAssignment }).assignment;
    if (venue) {
      // Assignment email (+ claim deep-link / invitation row if unclaimed).
      // Same notify path as couple Submit. Skip when assignment already existed.
      notifyVendorOfEventAssignment({
        venueId: venue.id,
        venueName: venue.name,
        eventId,
        assignmentId: assignment.id,
        vendorId: input.vendorId,
      });
    }
  }
  return result as { ok: true; assignment: EventVendorAssignment } | VendorActionResult;
}

/** Preparation only. Does not reserve the vendor's calendar or tell them an event is booked. */
export async function assignVendorToClient(
  clientId: string, input: VendorAssignmentInput,
): Promise<{ ok: true; assignment: EventVendorAssignment } | VendorActionResult> {
  const errors = validateAssignmentInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors, message: errors.vendorId };
  const result = await withVenue(async (supabase, venueId) => {
    const inserted = await repo.insertClientVendorAssignment(supabase, venueId, clientId, input);
    return { ok: true, assignment: inserted.assignment };
  });
  return result as { ok: true; assignment: EventVendorAssignment } | VendorActionResult;
}

export async function removeVendorAssignment(assignmentId: string): Promise<VendorActionResult> {
  let notify: {
    venueId: string;
    venueName: string;
    eventId: string;
    vendorId: string;
  } | null = null;

  const result = await withVenue(async (supabase, venueId) => {
    // Snapshot before DELETE — conversations / assignment row are gone after cascade.
    const { data: prior } = await supabase
      .from("event_vendor_assignments")
      .select("id, event_id, vendor_id")
      .eq("id", assignmentId)
      .eq("venue_id", venueId)
      .maybeSingle<{ id: string; event_id: string; vendor_id: string }>();

    if (!prior) {
      return { ok: false, message: "That vendor assignment is no longer available." } as VendorActionResult;
    }

    // Delete first — only run side effects when the row was actually removed.
    // RESTRICTIVE event_vendor_assignments_delete_gate can silently block
    // Coordinator/Staff; treating that as success previously approved removal
    // requests, cleared Booked days, and emailed the vendor incorrectly.
    const deleted = await repo.deleteVendorAssignment(supabase, venueId, assignmentId);
    if (!deleted.ok) {
      return { ok: false, message: deleted.message } as VendorActionResult;
    }

    await approvePendingRequestsForAssignment(supabase, venueId, assignmentId);
    // Free the Booked day if this assignment was the occupant (manual blocks stay).
    await clearAssignmentBooked(assignmentId);

    const venue = await getCurrentVenue();
    notify = {
      venueId,
      venueName: venue?.name ?? "Your venue",
      eventId: prior.event_id,
      vendorId: prior.vendor_id,
    };
    return { ok: true } as VendorActionResult;
  });

  if ((result as VendorActionResult).ok && notify) {
    notifyVendorOfEventRemoval(notify);
  }
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
