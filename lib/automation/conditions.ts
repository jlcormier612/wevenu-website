/**
 * Automation Framework — Phase 1: condition evaluation.
 *
 * Conditions read only fields already present on the Platform Event
 * envelope itself (never a live re-fetch of the triggering entity) — the
 * same discipline the event contract's own "minimal payload" rule
 * establishes (docs/platform-event-adoption-plan.md §2). If a rule needs
 * to condition on something not in the payload, the fix is the owning
 * feature adding that field to what it publishes — never the automation
 * engine reaching into a table it doesn't own to find it.
 */
import type { PlatformEvent } from "@/lib/platform-events/types";
import type { AutomationCondition } from "./types";

function getField(event: PlatformEvent, field: string): unknown {
  if (field.startsWith("payload.")) return event.payload[field.slice("payload.".length)];
  switch (field) {
    case "venueId": return event.venueId;
    case "clientId": return event.clientId;
    case "entityType": return event.entityType;
    case "entityId": return event.entityId;
    case "sourceFeature": return event.sourceFeature;
    case "actorType": return event.actor.type;
    default: return undefined;
  }
}

export function evaluateConditions(event: PlatformEvent, conditions: AutomationCondition[]): boolean {
  return conditions.every((condition) => {
    const actual = getField(event, condition.field);
    switch (condition.operator) {
      case "eq": return actual === condition.value;
      case "neq": return actual !== condition.value;
      case "in": return Array.isArray(condition.value) && condition.value.includes(actual);
      case "gte": return typeof actual === "string" && typeof condition.value === "string" && actual >= condition.value;
      case "lte": return typeof actual === "string" && typeof condition.value === "string" && actual <= condition.value;
      case "exists": return actual !== undefined && actual !== null;
      default: return false;
    }
  });
}
