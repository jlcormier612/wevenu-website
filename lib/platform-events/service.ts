/**
 * Platform Event Framework — Phase 1 (infrastructure only).
 *
 * emitPlatformEvent() is the framework's one publishing mechanism for
 * application code. It wraps the same emit_platform_event() Postgres
 * function every SQL trigger also calls (see the Phase 1 migration) — one
 * thing actually performs the write, regardless of which side calls it.
 *
 * Never throws: a Platform Event failing to publish must never break the
 * caller's own business transaction. The RPC itself already swallows
 * errors internally (matching create_venue_notification's own
 * exception handler); this try/catch is a second, defensive layer at the
 * TypeScript boundary in case the RPC call itself fails before reaching
 * that point (a dropped connection, an expired session).
 */
import { createClient } from "@/integrations/supabase/server";
import type { PlatformEventInput } from "./types";

export async function emitPlatformEvent(input: PlatformEventInput): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.rpc("emit_platform_event", {
      p_event_type: input.eventType,
      p_source_feature: input.sourceFeature,
      p_entity_type: input.entityType,
      p_entity_id: input.entityId,
      p_venue_id: input.venueId,
      p_client_id: input.clientId ?? null,
      p_actor_type: input.actor?.type ?? null,
      p_actor_id: input.actor?.id ?? null,
      p_actor_name: input.actor?.name ?? null,
      p_payload: input.payload ?? {},
    });
  } catch {
    // Platform Events are infrastructure — never break the caller.
  }
}
