/**
 * Platform Event Framework — Phase 1 (infrastructure only).
 *
 * The canonical event contract from docs/platform-event-adoption-plan.md §2.
 * A Platform Event announces that something meaningful happened — it never
 * performs work, never notifies anyone, never runs an automation. Nothing
 * in this codebase consumes these yet (adoption plan §5 — no consumer
 * migration in this phase).
 */

export type PlatformEventActorType = "staff" | "client" | "vendor" | "system";

export type PlatformEventActor = {
  type: PlatformEventActorType;
  id: string | null;
  name: string | null;
};

/**
 * `payload` is deliberately minimal — the field(s) needed to route on, never
 * a denormalized copy of the entity's current state (adoption plan §2). A
 * future consumer that needs more always re-fetches the entity through its
 * owning feature's own service function.
 */
export type PlatformEventInput = {
  eventType: string;        // "Feature.Verb" — see docs/platform-event-adoption-plan.md §3
  sourceFeature: string;
  entityType: string;
  entityId: string;
  venueId: string;
  clientId?: string | null;
  actor?: Partial<PlatformEventActor>;
  payload?: Record<string, unknown>;
};

export type PlatformEvent = {
  id: string;
  eventType: string;
  sourceFeature: string;
  entityType: string;
  entityId: string;
  venueId: string;
  clientId: string | null;
  actor: PlatformEventActor;
  payload: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
};
