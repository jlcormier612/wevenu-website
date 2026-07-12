/**
 * Platform Event Framework — Phase 1: wraps Request lifecycle events.
 *
 * Registers against the existing, already-designed seam in
 * lib/requests/hooks.ts — lib/requests/service.ts and lib/requests/portal.ts
 * are completely unmodified by this file. request_lifecycle_events keeps
 * being written exactly as it is today, by exactly the same code; this
 * handler only adds a Platform Event publish alongside it, the same
 * "wrap, don't touch" shape as the Booking/Event SQL trigger wrap.
 *
 * register() is called once, at server startup, from instrumentation.ts —
 * not imported by any Request Framework file, so the framework starting
 * empty (per hooks.ts's own header comment) is undisturbed by any other
 * caller of onRequestLifecycleEvent().
 */
import { createClient as createServiceClient } from "@supabase/supabase-js";

import { onRequestLifecycleEvent, type RequestLifecycleEvent } from "@/lib/requests/hooks";
import type { RequestStatus } from "@/lib/requests/types";
import { emitPlatformEvent } from "./service";

// "Feature.Verb" per docs/platform-event-adoption-plan.md §3. Submitted/
// Reviewed/Completed are the three named in the adoption plan's own event
// list; the remaining statuses extend the same convention consistently
// rather than dropping them or inventing a mismatched generic catch-all.
const STATUS_EVENT_NAME: Record<RequestStatus, string> = {
  draft: "Request.Draft",
  sent: "Request.Sent",
  viewed: "Request.Viewed",
  in_progress: "Request.InProgress",
  submitted: "Request.Submitted",
  reviewed: "Request.Reviewed",
  completed: "Request.Completed",
  cancelled: "Request.Cancelled",
};

// Only the client_submitted case lacks a venueId (it originates from a
// portal RPC with no staff session, per lib/requests/portal.ts) — a
// service-role client is the same "system process, not an authenticated
// user" pattern lib/notifications/engine.ts already uses, needed here only
// for this one read.
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function handle(event: RequestLifecycleEvent): Promise<void> {
  switch (event.type) {
    case "created":
      await emitPlatformEvent({
        eventType: "Request.Created",
        sourceFeature: "requests",
        entityType: "request",
        entityId: event.request.id,
        venueId: event.request.venueId,
        clientId: event.request.clientId,
        payload: { sourceFeature: event.request.sourceFeature, requestType: event.request.requestType },
      });
      return;

    case "status_changed":
      await emitPlatformEvent({
        eventType: STATUS_EVENT_NAME[event.toStatus],
        sourceFeature: "requests",
        entityType: "request",
        entityId: event.request.id,
        venueId: event.request.venueId,
        clientId: event.request.clientId,
        payload: { fromStatus: event.fromStatus, toStatus: event.toStatus },
      });
      return;

    case "assigned":
      await emitPlatformEvent({
        eventType: "Request.Assigned",
        sourceFeature: "requests",
        entityType: "request",
        entityId: event.request.id,
        venueId: event.request.venueId,
        clientId: event.request.clientId,
        payload: { staffId: event.staffId },
      });
      return;

    case "reassigned":
      await emitPlatformEvent({
        eventType: "Request.Reassigned",
        sourceFeature: "requests",
        entityType: "request",
        entityId: event.request.id,
        venueId: event.request.venueId,
        clientId: event.request.clientId,
        payload: { fromStaffId: event.fromStaffId, toStaffId: event.toStaffId },
      });
      return;

    case "client_submitted": {
      // Canonical "Request.Submitted" — the same event name the venue-side
      // status_changed path would use, regardless of which of the two code
      // paths detected it (this convergence is the entire point of a shared
      // event contract, per docs/platform-orchestration-architecture.md §7
      // Example A).
      const service = getServiceClient();
      if (!service) return;
      const { data } = await service.from("requests").select("venue_id").eq("id", event.requestId).maybeSingle();
      if (!data) return;
      await emitPlatformEvent({
        eventType: "Request.Submitted",
        sourceFeature: "requests",
        entityType: "request",
        entityId: event.requestId,
        venueId: data.venue_id as string,
        clientId: event.clientId,
        actor: { type: "client", id: event.clientId, name: null },
        payload: { fromStatus: event.fromStatus, toStatus: event.toStatus },
      });
      return;
    }
  }
}

export function register(): void {
  onRequestLifecycleEvent(handle);
}
