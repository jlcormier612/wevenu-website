/**
 * Automation Framework — venue-session-scoped reads/writes.
 * lib/automation/actions.ts and engine.ts run as a system process and
 * never import from here (or from lib/venue/service.ts) — this file is
 * only for interactive Settings UI, the counterpart the Phase 1 scope
 * note in actions.ts's header describes.
 *
 * No general rules editor exists yet (automation_rules has full CRUD RLS
 * ready for one later) — this exposes exactly one purpose-built toggle for
 * RC2's Event.Completed → review/referral nudge, not a generic API.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";
import type { AutomationRule } from "@/lib/automation/types";

const EVENT_COMPLETED_NUDGE_ACTION = "schedule_relationship_message";

type RuleRow = {
  id: string; venue_id: string; name: string; trigger_event_type: string;
  conditions: unknown; action_type: string; action_params: Record<string, unknown>; enabled: boolean;
};

function mapRule(r: RuleRow): AutomationRule {
  return {
    id: r.id, venueId: r.venue_id, name: r.name, triggerEventType: r.trigger_event_type,
    conditions: Array.isArray(r.conditions) ? r.conditions as AutomationRule["conditions"] : [],
    actionType: r.action_type, actionParams: r.action_params, enabled: r.enabled,
  };
}

export async function getEventCompletedNudgeRule(): Promise<AutomationRule | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("automation_rules").select("*")
    .eq("venue_id", venue.id)
    .eq("trigger_event_type", "Event.Completed")
    .eq("action_type", EVENT_COMPLETED_NUDGE_ACTION)
    .maybeSingle<RuleRow>();
  if (error) throw error;
  return data ? mapRule(data) : null;
}

export async function setEventCompletedNudgeEnabled(enabled: boolean): Promise<{ ok: boolean; message?: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { error } = await supabase.from("automation_rules")
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq("venue_id", venue.id)
    .eq("trigger_event_type", "Event.Completed")
    .eq("action_type", EVENT_COMPLETED_NUDGE_ACTION);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
