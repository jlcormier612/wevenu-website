/**
 * Event-specific vendor assignment cutover — canonical event_vendor_assignments
 * via the same insert path native Assign uses, without outbound notifications.
 */

import type { createClient } from "@/integrations/supabase/server";
import { resolveEventForMigration } from "@/lib/migration/resolve-refs";
import * as vendorsRepo from "@/lib/vendors/repository";
import { markAssignmentBooked } from "@/lib/vendor-availability/sync";
import type { VendorAssignmentInput, VendorInput } from "@/lib/vendors/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

export type NormalizedEventVendorAssignment = {
  eventId?: string | null;
  clientEmail?: string | null;
  clientId?: string | null;
  eventDate?: string | null;
  vendorId?: string | null;
  vendorBusinessName?: string | null;
  category?: string | null;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  arrivalTime?: string | null;
  setupLocation?: string | null;
  loadInNotes?: string | null;
  notes?: string | null;
  agreedFee?: string | null;
  paymentStatus?: "pending" | "paid" | null;
  sourceId?: string | null;
};

export type AssignmentCommitResult =
  | {
    ok: true;
    assignmentId: string;
    vendorId: string;
    eventId: string;
    alreadyExisted?: boolean;
    createdVendor?: boolean;
  }
  | { ok: false; error: string };

export function validateEventVendorAssignment(n: NormalizedEventVendorAssignment): string | null {
  if (!n.eventId?.trim() && !n.clientEmail?.trim() && !n.clientId?.trim()) {
    return "Assignments need eventId, or client email / client id (with eventDate).";
  }
  if (!n.vendorId?.trim() && !n.vendorBusinessName?.trim()) {
    return "Assignments need vendorId or vendorBusinessName.";
  }
  if (n.paymentStatus && n.paymentStatus !== "pending" && n.paymentStatus !== "paid") {
    return "paymentStatus must be pending or paid.";
  }
  return null;
}

async function resolveVendorId(
  client: DbClient,
  venueId: string,
  n: NormalizedEventVendorAssignment,
): Promise<{ ok: true; vendorId: string; createdVendor: boolean } | { ok: false; error: string }> {
  if (n.vendorId?.trim()) {
    const { data } = await client.from("vendors")
      .select("id")
      .eq("id", n.vendorId.trim())
      .maybeSingle<{ id: string }>();
    // vendors may be global; venue relationship is separate — accept id if present.
    if (!data) return { ok: false, error: `Vendor id "${n.vendorId}" was not found.` };
    return { ok: true, vendorId: data.id, createdVendor: false };
  }

  const businessName = n.vendorBusinessName!.trim();
  const dup = await vendorsRepo.findActiveDuplicateVendor(
    client, venueId, businessName, n.email?.trim() ?? "",
  );
  if (dup?.id) return { ok: true, vendorId: dup.id, createdVendor: false };

  const input = {
    businessName,
    category: n.category ?? "",
    contactName: n.contactName ?? "",
    email: n.email ?? "",
    phone: n.phone ?? "",
    websiteUrl: "",
    instagramUrl: "",
    facebookUrl: "",
    pinterestUrl: "",
    tiktokUrl: "",
    preferenceLevel: "recommended",
    description: "",
    logoUrl: "",
    pricingTier: "",
    notes: "Imported via Bring Your Business for an active Event assignment.",
    specialPricingNote: "",
  } as VendorInput;
  const vendorId = await vendorsRepo.insertVendor(client, venueId, input);
  return { ok: true, vendorId, createdVendor: true };
}

/**
 * Quiet assignment: same tables/triggers as native Assign (including conversation
 * provision), but never emails the vendor or creates claim invitations.
 * Does not fabricate check-in / setup-complete timestamps.
 */
export async function commitEventVendorAssignmentQuietly(
  client: DbClient,
  venueId: string,
  n: NormalizedEventVendorAssignment,
): Promise<AssignmentCommitResult> {
  const validationError = validateEventVendorAssignment(n);
  if (validationError) return { ok: false, error: validationError };

  const resolved = await resolveEventForMigration(client, venueId, n);
  if (!resolved.ok) return resolved;

  if (resolved.eventDate) {
    const today = new Date().toISOString().slice(0, 10);
    if (resolved.eventDate < today) {
      return { ok: false, error: "Vendor assignments for past Events are not imported as active business." };
    }
  }

  const vendor = await resolveVendorId(client, venueId, n);
  if (!vendor.ok) return vendor;

  const assignmentInput: VendorAssignmentInput = {
    vendorId: vendor.vendorId,
    arrivalTime: n.arrivalTime?.trim() ?? "",
    setupLocation: n.setupLocation?.trim() ?? "",
    loadInNotes: n.loadInNotes?.trim() ?? "",
    notes: [
      n.notes?.trim() || "",
      n.sourceId?.trim() ? `[migration:${n.sourceId.trim()}]` : "",
      "Imported via Bring Your Business — quiet assignment (no vendor email).",
    ].filter(Boolean).join("\n"),
  };

  const inserted = await vendorsRepo.insertVendorAssignment(
    client, venueId, resolved.eventId, assignmentInput,
  );

  if (!inserted.created) {
    return {
      ok: true,
      assignmentId: inserted.assignment.id,
      vendorId: vendor.vendorId,
      eventId: resolved.eventId,
      alreadyExisted: true,
      createdVendor: vendor.createdVendor,
    };
  }

  // Native Assign fires an in-app vendor_notifications row via DB trigger.
  // Quiet migration must not leave that alert (and never sends email/claim).
  try {
    await client.from("vendor_notifications")
      .delete()
      .eq("assignment_id", inserted.assignment.id)
      .eq("type", "assigned_to_event");
  } catch { /* best-effort; assignment itself must succeed */ }

  const { data: event } = await client.from("events")
    .select("event_date, event_end_date, name, status")
    .eq("id", resolved.eventId)
    .maybeSingle<{
      event_date: string | null;
      event_end_date: string | null;
      name: string;
      status: string;
    }>();
  if (event) {
    await markAssignmentBooked({
      assignmentId: inserted.assignment.id,
      vendorId: vendor.vendorId,
      eventDate: event.event_date,
      eventEndDate: event.event_end_date,
      eventName: event.name,
      eventStatus: event.status,
    });
  }

  if (n.agreedFee?.trim() || n.paymentStatus) {
    const fee = n.agreedFee?.trim() ? Number(n.agreedFee) : null;
    await vendorsRepo.setVendorAssignmentPayment(
      client,
      venueId,
      inserted.assignment.id,
      fee != null && Number.isFinite(fee) ? fee : null,
      n.paymentStatus === "paid" ? "paid" : "pending",
    );
  }

  return {
    ok: true,
    assignmentId: inserted.assignment.id,
    vendorId: vendor.vendorId,
    eventId: resolved.eventId,
    createdVendor: vendor.createdVendor,
  };
}
