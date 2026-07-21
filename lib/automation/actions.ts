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
 * Three actions are implemented so far — not a library of automations
 * (out of scope, per docs/platform-event-adoption-plan.md's own Phase 1
 * scope), but proving the registry pattern generalizes:
 *   - apply_planning_template — calls lib/playbooks/repository.ts's
 *     applyPlaybookToEvent() directly.
 *   - send_notification — calls the existing create_venue_notification()
 *     Postgres function via RPC, the same one every trigger-based
 *     notification already uses.
 *   - schedule_relationship_message (RC2, Milestone 4) — calls
 *     lib/scheduled-messages/repository.ts's insertScheduledMessage()
 *     directly, the same table/processor every coordinator-composed
 *     Scheduled Send already uses. Powers the Event.Completed →
 *     review/referral nudge without inventing a second communication
 *     model — it's a Scheduled Send like any other, just queued by an
 *     Automation Rule instead of a coordinator's own click.
 */
import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";

import * as playbooksRepo from "@/lib/playbooks/repository";
import * as scheduledMessagesRepo from "@/lib/scheduled-messages/repository";
import type { ScheduledMessageChannel } from "@/lib/scheduled-messages/types";
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

/**
 * Queues a Scheduled Send for the relationship the triggering Platform
 * Event is about — offsetDays out from when the event fires, not
 * immediately (a review/referral ask the moment the wedding ends reads as
 * tone-deaf; a few days later reads as thoughtful). Reuses
 * event.clientId, already populated on Event.Completed/Booking.Confirmed
 * (see log_event_status_changed()), rather than re-fetching the event row.
 */
async function scheduleRelationshipMessage(params: Record<string, unknown>, event: PlatformEvent): Promise<ActionResult> {
  if (!event.clientId) return { ok: false, error: "This Platform Event has no client." };

  const client = getServiceClient();
  if (!client) return { ok: false, error: "Service role not configured." };

  const { data: clientRow, error: fetchError } = await client
    .from("clients").select("relationship_id").eq("id", event.clientId).maybeSingle();
  if (fetchError) return { ok: false, error: fetchError.message };
  const relationshipId = (clientRow as { relationship_id: string | null } | null)?.relationship_id;
  if (!relationshipId) return { ok: false, error: "Client has no relationship." };

  const channel = (params.channel as ScheduledMessageChannel) ?? "email";
  const body = typeof params.body === "string" ? params.body : "";
  if (!body.trim()) return { ok: false, error: "Missing required action param: body." };
  const offsetDays = typeof params.offsetDays === "number" ? params.offsetDays : 3;
  const scheduledFor = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000).toISOString();

  try {
    await scheduledMessagesRepo.insertScheduledMessage(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any,
      event.venueId,
      {
        relationshipId, templateId: null, channel,
        emailSubject: typeof params.subject === "string" ? params.subject : "",
        body, scheduledFor,
      },
    );
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error scheduling message." };
  }
}

export const ACTION_REGISTRY: Record<string, ActionHandler> = {
  apply_planning_template: applyPlanningTemplate,
  send_notification: sendNotification,
  schedule_relationship_message: scheduleRelationshipMessage,
};
