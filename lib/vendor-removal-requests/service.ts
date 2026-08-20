/**
 * Event vendor removal requests — venue confirms; couple/vendor only request.
 */
import { createVendorClient as createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getVendorUser } from "@/lib/vendor-auth/service";
import { getCurrentVenue } from "@/lib/venue/service";
import type { VendorActionResult } from "@/lib/vendors/types";
import type { EventVendorRemovalRequest } from "./types";

type Row = {
  id: string;
  venue_id: string;
  event_id: string;
  vendor_id: string;
  assignment_id: string | null;
  requested_by: "couple" | "vendor";
  reason: string | null;
  status: "pending" | "approved" | "dismissed";
  created_at: string;
  resolved_at: string | null;
};

function mapRow(r: Row): EventVendorRemovalRequest {
  return {
    id: r.id,
    venueId: r.venue_id,
    eventId: r.event_id,
    vendorId: r.vendor_id,
    assignmentId: r.assignment_id,
    requestedBy: r.requested_by,
    reason: r.reason,
    status: r.status,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
  };
}

export async function getPendingRemovalRequestsForEvent(
  eventId: string,
): Promise<EventVendorRemovalRequest[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_vendor_removal_requests")
    .select("*")
    .eq("event_id", eventId)
    .eq("venue_id", venue.id)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[getPendingRemovalRequestsForEvent]", error.message);
    return [];
  }
  return ((data ?? []) as Row[]).map(mapRow);
}

export async function dismissRemovalRequest(
  requestId: string,
  eventId: string,
): Promise<VendorActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expired." };

  const { error } = await supabase
    .from("event_vendor_removal_requests")
    .update({ status: "dismissed", resolved_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("venue_id", venue.id)
    .eq("event_id", eventId)
    .eq("status", "pending");

  if (error) {
    console.error("[dismissRemovalRequest]", error.message);
    return { ok: false, message: "Could not dismiss request." };
  }
  return { ok: true };
}

/** Approve all pending requests tied to an assignment (before hard DELETE). */
export async function approvePendingRequestsForAssignment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  venueId: string,
  assignmentId: string,
): Promise<void> {
  const { error } = await supabase
    .from("event_vendor_removal_requests")
    .update({ status: "approved", resolved_at: new Date().toISOString() })
    .eq("venue_id", venueId)
    .eq("assignment_id", assignmentId)
    .eq("status", "pending");
  if (error) {
    console.error("[approvePendingRequestsForAssignment]", error.message);
  }
}

export async function vendorHasPendingLeaveRequest(
  assignmentId: string,
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const vendorUser = await getVendorUser();
  if (!vendorUser) return false;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_vendor_removal_requests")
    .select("id")
    .eq("assignment_id", assignmentId)
    .eq("vendor_id", vendorUser.vendorId)
    .eq("requested_by", "vendor")
    .eq("status", "pending")
    .maybeSingle<{ id: string }>();
  if (error) {
    console.error("[vendorHasPendingLeaveRequest]", error.message);
    return false;
  }
  return !!data;
}

export async function requestAssignmentRemoval(
  assignmentId: string,
  reason: string | null,
): Promise<VendorActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const vendorUser = await getVendorUser();
  if (!vendorUser) return { ok: false, message: "No vendor account found." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_event_assignment_removal", {
    p_assignment_id: assignmentId,
    p_reason: reason?.trim() || null,
  });
  if (error) {
    console.error("[requestAssignmentRemoval]", error.message);
    return { ok: false, message: "Could not send request." };
  }
  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    return { ok: false, message: result?.error === "not_found" ? "Assignment not found." : "Could not send request." };
  }
  return { ok: true };
}
