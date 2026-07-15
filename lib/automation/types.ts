/**
 * Automation Framework — Phase 1 (infrastructure only).
 *
 * A rule is deliberately small: one trigger, a flat list of ANDed
 * conditions, one action. No nested logic, no scripting, no visual
 * builder — per docs/platform-event-adoption-plan.md and this phase's own
 * scope. See lib/automation/conditions.ts and lib/automation/actions.ts
 * for how these are evaluated and executed.
 */

export type ConditionOperator = "eq" | "neq" | "in" | "gte" | "lte" | "exists";

export type AutomationCondition = {
  /** A top-level PlatformEvent field ("venueId", "entityType", ...) or a "payload.*" dot-path. */
  field: string;
  operator: ConditionOperator;
  value?: unknown;
};

export type AutomationRule = {
  id: string;
  venueId: string;
  name: string;
  triggerEventType: string;
  conditions: AutomationCondition[];
  actionType: string;
  actionParams: Record<string, unknown>;
  enabled: boolean;
};

export type AutomationExecutionStatus = "success" | "failed" | "conditions_not_met";
