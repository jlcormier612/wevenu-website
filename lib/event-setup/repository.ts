import { createClient } from "@/integrations/supabase/server";

import { eventSetupFromColumns, eventSetupToColumns } from "@/lib/event-setup/profile";
import { type EventSetupState, type SetupDecision } from "@/lib/event-setup/state";

const SETUP_COLUMNS =
  "collapsed_at, decisions, uses_profile, profile_id, profile_name, inherited_decisions, inherited_template_refs, overrides";

type Row = {
  collapsed_at: string | null;
  decisions: unknown;
  uses_profile: boolean | null;
  profile_id: string | null;
  profile_name: string | null;
  inherited_decisions: unknown;
  inherited_template_refs: unknown;
  overrides: unknown;
};

export async function getEventSetupState(venueId: string, eventId: string): Promise<EventSetupState> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_setup_states")
    .select(SETUP_COLUMNS)
    .eq("venue_id", venueId)
    .eq("event_id", eventId)
    .maybeSingle<Row>();
  if (error) throw error;
  return eventSetupFromColumns(data);
}

export async function saveEventSetupState(
  venueId: string,
  eventId: string,
  state: EventSetupState,
): Promise<EventSetupState> {
  const supabase = await createClient();
  const columns = eventSetupToColumns(state);
  const { data, error } = await supabase
    .from("event_setup_states")
    .upsert(
      {
        event_id: eventId,
        venue_id: venueId,
        ...columns,
      },
      { onConflict: "event_id" },
    )
    .select(SETUP_COLUMNS)
    .single<Row>();
  if (error) throw error;
  return eventSetupFromColumns(data);
}

export function decisionValue(value: string): SetupDecision | null {
  if (value === "set_up" || value === "skipped") return value;
  return null;
}
