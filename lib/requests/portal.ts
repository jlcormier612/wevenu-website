/**
 * Request Framework — Wedding Workspace (portal, token-scoped) surface.
 *
 * Separate from service.ts (venue-staff-authenticated) on purpose, same as
 * lib/portal/service.ts is separate from lib/clients/service.ts elsewhere
 * in this codebase — every function here is authorized by the portal
 * token alone, via the same SECURITY DEFINER RPC pattern every other
 * Wedding Workspace feature already uses (get_couple_documents,
 * get_portal_tasks, etc.), not by a venue staff session.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { emitRequestLifecycleEvent } from "./hooks";
import type { PortalRequestDetail, PortalRequestSummary, RequestStatus } from "./types";

export async function getPortalRequests(token: string): Promise<PortalRequestSummary[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_portal_requests", { p_token: token });
  if (error) return [];
  return (data?.requests ?? []) as PortalRequestSummary[];
}

export async function getPortalRequestDetail(token: string, requestId: string): Promise<PortalRequestDetail | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_portal_request_detail", { p_token: token, p_request_id: requestId });
  if (error || !data) return null;
  return data as PortalRequestDetail;
}

export async function submitPortalRequest(
  token: string, requestId: string, responseText: string | null, responseFileUrl: string | null,
): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: "Backend not configured." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_portal_request", {
    p_token: token, p_request_id: requestId, p_response_text: responseText, p_response_file_url: responseFileUrl,
  });
  if (error) return { ok: false, error: error.message };
  if (!data?.ok) return { ok: false, error: data?.error ?? "Could not submit." };

  // Requirement 7 — every transition emits a lifecycle event, including
  // client-initiated ones (not just the staff-side ones already wired in
  // lib/requests/service.ts).
  await emitRequestLifecycleEvent({
    type: "client_submitted",
    requestId,
    clientId: data.clientId as string,
    fromStatus: data.fromStatus as RequestStatus,
    toStatus: "submitted",
  });

  return { ok: true, status: data.status };
}
