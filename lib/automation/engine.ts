/**
 * Automation Engine — Phase 1.
 *
 * Consumes Platform Events: for every enabled automation_rules row, finds
 * matching platform_events by trigger_event_type + venue, evaluates the
 * rule's conditions, and executes the matched action through the Action
 * Registry. Every attempt — matched or not, successful or not — is
 * recorded in automation_executions.
 *
 * Not a continuously-running process — invoked per-run, the same shape as
 * the existing notification/reminder sweep (lib/notifications/engine.ts):
 * POST/GET /api/automation/process today, a cron target exactly like that
 * engine already has (see vercel.json).
 *
 * Idempotency: automation_executions has a unique constraint on
 * (rule_id, platform_event_id) — this function checks for an existing row
 * before acting, so a repeated or overlapping run only ever executes a
 * given rule against a given event once. Because this engine runs
 * separately from whatever emitted the event, a failure here can never
 * block or roll back the feature transaction that produced it — the
 * Platform Event was already committed before this function ever looks
 * at it.
 */
import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";

import { evaluateConditions } from "./conditions";
import { ACTION_REGISTRY } from "./actions";
import type { AutomationCondition, AutomationExecutionStatus } from "./types";
import type { PlatformEvent } from "@/lib/platform-events/types";

const BATCH_SIZE = 50;

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for automation engine.");
  return createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export type ProcessResult = { evaluated: number; executed: number; skipped: number; failed: number };

type RuleRow = {
  id: string; venue_id: string; trigger_event_type: string;
  conditions: AutomationCondition[]; action_type: string; action_params: Record<string, unknown>;
};

type PlatformEventRow = {
  id: string; event_type: string; source_feature: string; entity_type: string; entity_id: string;
  venue_id: string; client_id: string | null;
  actor_type: PlatformEvent["actor"]["type"] | null; actor_id: string | null; actor_name: string | null;
  payload: Record<string, unknown>; occurred_at: string; created_at: string;
};

function toPlatformEvent(row: PlatformEventRow): PlatformEvent {
  return {
    id: row.id, eventType: row.event_type, sourceFeature: row.source_feature,
    entityType: row.entity_type, entityId: row.entity_id, venueId: row.venue_id, clientId: row.client_id,
    actor: { type: row.actor_type ?? "system", id: row.actor_id, name: row.actor_name },
    payload: row.payload ?? {}, occurredAt: row.occurred_at, createdAt: row.created_at,
  };
}

export async function processAutomationEvents(): Promise<ProcessResult> {
  const client = getServiceClient();
  const result: ProcessResult = { evaluated: 0, executed: 0, skipped: 0, failed: 0 };

  const { data: rules } = await client.from("automation_rules").select("*").eq("enabled", true);
  if (!rules || rules.length === 0) return result;

  for (const rule of rules as RuleRow[]) {
    const { data: events } = await client
      .from("platform_events")
      .select("*")
      .eq("event_type", rule.trigger_event_type)
      .eq("venue_id", rule.venue_id)
      .order("occurred_at", { ascending: true })
      .limit(BATCH_SIZE);
    if (!events || events.length === 0) continue;

    for (const row of events as PlatformEventRow[]) {
      const { data: existing } = await client
        .from("automation_executions")
        .select("id")
        .eq("rule_id", rule.id)
        .eq("platform_event_id", row.id)
        .maybeSingle();
      if (existing) continue; // already evaluated for this rule — idempotency guard

      result.evaluated++;
      const event = toPlatformEvent(row);
      const conditionsMet = evaluateConditions(event, rule.conditions ?? []);

      if (!conditionsMet) {
        await recordExecution(client, rule.id, row.id, "conditions_not_met", null);
        result.skipped++;
        continue;
      }

      const handler = ACTION_REGISTRY[rule.action_type];
      if (!handler) {
        await recordExecution(client, rule.id, row.id, "failed", `Unknown action type: ${rule.action_type}`);
        result.failed++;
        continue;
      }

      try {
        const actionResult = await handler(rule.action_params ?? {}, event);
        if (actionResult.ok) {
          await recordExecution(client, rule.id, row.id, "success", null);
          result.executed++;
        } else {
          await recordExecution(client, rule.id, row.id, "failed", actionResult.error);
          result.failed++;
        }
      } catch (e) {
        await recordExecution(client, rule.id, row.id, "failed", e instanceof Error ? e.message : "Unknown error");
        result.failed++;
      }
    }
  }

  return result;
}

async function recordExecution(
  client: SupabaseClient,
  ruleId: string, platformEventId: string, status: AutomationExecutionStatus, error: string | null,
): Promise<void> {
  // A unique-constraint violation here means a concurrent run already
  // recorded this same (rule, event) pair — that IS the idempotency
  // guarantee, not a failure to surface.
  await client.from("automation_executions").insert({ rule_id: ruleId, platform_event_id: platformEventId, status, error });
}
