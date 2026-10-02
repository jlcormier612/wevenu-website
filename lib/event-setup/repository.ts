import { createClient } from "@/integrations/supabase/server";

import {
  emptyEventSetupState,
  isSetupStepKey,
  type EventSetupState,
  type SetupDecision,
  type SetupDecisions,
} from "@/lib/event-setup/state";

type Row = {
  collapsed_at: string | null;
  decisions: unknown;
};

function parseDecisions(value: unknown): SetupDecisions {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const decisions: SetupDecisions = {};
  for (const [key, decision] of Object.entries(value)) {
    if (!isSetupStepKey(key)) continue;
    if (decision === "set_up" || decision === "skipped") decisions[key] = decision;
  }
  return decisions;
}

function mapRow(row: Row | null): EventSetupState {
  if (!row) return emptyEventSetupState();
  return {
    decisions: parseDecisions(row.decisions),
    collapsedAt: row.collapsed_at,
  };
}

export async function getEventSetupState(venueId: string, eventId: string): Promise<EventSetupState> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_setup_states")
    .select("collapsed_at, decisions")
    .eq("venue_id", venueId)
    .eq("event_id", eventId)
    .maybeSingle<Row>();
  if (error) throw error;
  return mapRow(data);
}

export async function saveEventSetupState(
  venueId: string,
  eventId: string,
  state: EventSetupState,
): Promise<EventSetupState> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_setup_states")
    .upsert(
      {
        event_id: eventId,
        venue_id: venueId,
        collapsed_at: state.collapsedAt,
        decisions: state.decisions,
      },
      { onConflict: "event_id" },
    )
    .select("collapsed_at, decisions")
    .single<Row>();
  if (error) throw error;
  return mapRow(data);
}

export function decisionValue(value: string): SetupDecision | null {
  if (value === "set_up" || value === "skipped") return value;
  return null;
}
