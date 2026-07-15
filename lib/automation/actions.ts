/**
 * Automation Framework — Phase 1: the Action Registry.
 *
 * Every action calls an owning feature's existing business logic directly
 * — never a re-implementation. Automation runs as a system process (no
 * interactive staff session — it's invoked by a sweep, not a click), so
 * actions call each feature's repository-layer function, which already
 * takes venueId as an explicit parameter and is not session-resolved,
 * rather than that feature's service-layer wrapper (whose only job is
 * resolving venueId from a cookie session — irrelevant here, since
 * Automation already knows venueId from the Platform Event itself). This
 * is the *same* function every interactive call site already uses, not a
 * second path — only the caller's auth context differs.
 *
 * Two actions are implemented in this phase — enough to prove the
 * registry pattern, not a library of automations (out of scope, per
 * docs/platform-event-adoption-plan.md's own Phase 1 scope):
 *   - apply_planning_template — calls lib/playbooks/repository.ts's
 *     applyPlaybookToEvent() directly.
 *   - send_notification — calls the existing create_venue_notification()
 *     Postgres function via RPC, the same one every trigger-based
 *     notification already uses.
 */
import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";

import * as playbooksRepo from "@/lib/playbooks/repository";
import type { PlatformEvent } from "@/lib/platform-events/types";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type ActionHandler = (params: Record<string, unknown>, event: PlatformEvent) => Promise<ActionResult>;

function getServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/**
 * Apply a Planning Template to the event a Booking.Confirmed/Event.Completed
 * Platform Event is about. Reuses lib/playbooks/repository.ts's
 * applyPlaybookToEvent() exactly — same validation (template exists),
 * same atomic "already applied" guard, same task/milestone creation. This
 * function adds no business logic; it only resolves the one thing that
 * function needs and Automation doesn't otherwise have (the event's own
 * date) and supplies a service-role client in place of a session one.
 */
async function applyPlanningTemplate(params: Record<string, unknown>, event: PlatformEvent): Promise<ActionResult> {
  const templateId = params.templateId;
  if (typeof templateId !== "string") return { ok: false, error: "Missing required action param: templateId." };

  const client = getServiceClient();
  if (!client) return { ok: false, error: "Service role not configured." };

  const { data: eventRow, error: fetchError } = await client
    .from("events").select("event_date").eq("id", event.entityId).maybeSingle();
  if (fetchError) return { ok: false, error: fetchError.message };
  if (!eventRow) return { ok: false, error: "Event not found." };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await playbooksRepo.applyPlaybookToEvent(client as any, event.venueId, event.entityId, templateId, eventRow.event_date as string);
    if (!result.ok) return { ok: false, error: `Template not applied: ${result.reason}.` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error applying template." };
  }
}

/**
 * Send an in-app notification through the exact same create_venue_notification()
 * function every trigger-based notification already calls (see
 * docs/platform-orchestration-architecture.md §0(a)) — the notification
 * bell, its schema, and its per-type preference gating are all untouched
 * and unaware this call came from Automation rather than a trigger.
 */
async function sendNotification(params: Record<string, unknown>, event: PlatformEvent): Promise<ActionResult> {
  const client = getServiceClient();
  if (!client) return { ok: false, error: "Service role not configured." };

  const { error } = await client.rpc("create_venue_notification", {
    p_venue_id: event.venueId,
    p_event_id: (params.eventId as string) ?? null,
    p_type: (params.type as string) ?? "automation",
    p_title: (params.title as string) ?? "Automation",
    p_body: (params.body as string) ?? null,
    p_link: (params.link as string) ?? null,
    p_emoji: (params.emoji as string) ?? null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export const ACTION_REGISTRY: Record<string, ActionHandler> = {
  apply_planning_template: applyPlanningTemplate,
  send_notification: sendNotification,
};
