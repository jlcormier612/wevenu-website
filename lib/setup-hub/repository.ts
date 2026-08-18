/**
 * Setup Hub data access layer. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import type { LeadCaptureChannelKey, LeadCaptureChannelState, SetupHubState } from "@/lib/setup-hub/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

type StateRow = {
  venue_id: string;
  onboarding_type: "self_setup" | "white_glove";
  your_venue_reviewed_at: string | null;
  calendar_availability_reviewed_at: string | null;
  bring_your_business_manual_confirmed_at: string | null;
  your_offerings_reviewed_at: string | null;
  client_experience_reviewed_at: string | null;
  lead_capture_path: "automated" | "manual_external" | null;
  lead_capture_path_decided_at: string | null;
  your_team_solo_confirmed_at: string | null;
  financials_reviewed_at: string | null;
  ready_to_invite_couples: boolean;
  ready_to_invite_couples_at: string | null;
};

type ChannelRow = {
  channel: LeadCaptureChannelKey;
  configured_at: string | null;
  verified_at: string | null;
};

const mapState = (r: StateRow): SetupHubState => ({
  venueId: r.venue_id,
  onboardingType: r.onboarding_type,
  yourVenueReviewedAt: r.your_venue_reviewed_at,
  calendarAvailabilityReviewedAt: r.calendar_availability_reviewed_at,
  bringYourBusinessManualConfirmedAt: r.bring_your_business_manual_confirmed_at,
  yourOfferingsReviewedAt: r.your_offerings_reviewed_at,
  clientExperienceReviewedAt: r.client_experience_reviewed_at,
  leadCapturePath: r.lead_capture_path,
  leadCapturePathDecidedAt: r.lead_capture_path_decided_at,
  yourTeamSoloConfirmedAt: r.your_team_solo_confirmed_at,
  financialsReviewedAt: r.financials_reviewed_at,
  readyToInviteCouples: r.ready_to_invite_couples,
  readyToInviteCouplesAt: r.ready_to_invite_couples_at,
});

const mapChannel = (r: ChannelRow): LeadCaptureChannelState => ({
  channel: r.channel,
  configuredAt: r.configured_at,
  verifiedAt: r.verified_at,
});

/** Row-existence is never itself a signal here — every column defaults to null/false. */
export async function getOrCreateState(client: DbClient, venueId: string, onboardingType: "self_setup" | "white_glove" = "self_setup"): Promise<SetupHubState> {
  const { data, error } = await client.from("venue_setup_hub_state").select("*").eq("venue_id", venueId).maybeSingle<StateRow>();
  if (error) throw error;
  if (data) return mapState(data);

  const { data: created, error: insertError } = await client.from("venue_setup_hub_state")
    .insert({ venue_id: venueId, onboarding_type: onboardingType })
    .select("*").single<StateRow>();
  if (insertError) throw insertError;
  return mapState(created);
}

export async function markStageReviewed(client: DbClient, venueId: string, column:
  "your_venue_reviewed_at" | "calendar_availability_reviewed_at" | "your_offerings_reviewed_at" | "client_experience_reviewed_at" | "financials_reviewed_at"
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("venue_setup_hub_state") as any)
    .update({ [column]: new Date().toISOString() })
    .eq("venue_id", venueId);
  if (error) throw error;
}

export async function setBringYourBusinessManual(client: DbClient, venueId: string): Promise<void> {
  const { error } = await client.from("venue_setup_hub_state")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ bring_your_business_manual_confirmed_at: new Date().toISOString() } as any)
    .eq("venue_id", venueId);
  if (error) throw error;
}

export async function setYourTeamSolo(client: DbClient, venueId: string): Promise<void> {
  const { error } = await client.from("venue_setup_hub_state")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ your_team_solo_confirmed_at: new Date().toISOString() } as any)
    .eq("venue_id", venueId);
  if (error) throw error;
}

export async function setLeadCapturePath(client: DbClient, venueId: string, path: "automated" | "manual_external"): Promise<void> {
  const { error } = await client.from("venue_setup_hub_state")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ lead_capture_path: path, lead_capture_path_decided_at: new Date().toISOString() } as any)
    .eq("venue_id", venueId);
  if (error) throw error;
}

export async function setReadyToInviteCouples(client: DbClient, venueId: string, ready: boolean, userId: string | null): Promise<void> {
  const { error } = await client.from("venue_setup_hub_state")
    .update(ready
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? ({ ready_to_invite_couples: true, ready_to_invite_couples_at: new Date().toISOString(), ready_to_invite_couples_declared_by: userId } as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      : ({ ready_to_invite_couples: false } as any))
    .eq("venue_id", venueId);
  if (error) throw error;
}

// ---- Lead Capture channels ---------------------------------------------------

export async function getLeadCaptureChannels(client: DbClient, venueId: string): Promise<LeadCaptureChannelState[]> {
  const { data, error } = await client.from("venue_lead_capture_channels").select("channel, configured_at, verified_at").eq("venue_id", venueId);
  if (error) throw error;
  return (data as ChannelRow[]).map(mapChannel);
}

export async function markChannelConfigured(client: DbClient, venueId: string, channel: LeadCaptureChannelKey): Promise<void> {
  const { error } = await client.from("venue_lead_capture_channels")
    .upsert({ venue_id: venueId, channel, configured_at: new Date().toISOString() }, { onConflict: "venue_id,channel", ignoreDuplicates: false });
  if (error) throw error;
}

export async function markChannelVerified(client: DbClient, venueId: string, channel: LeadCaptureChannelKey): Promise<void> {
  const { error } = await client.from("venue_lead_capture_channels")
    .upsert({ venue_id: venueId, channel, verified_at: new Date().toISOString() }, { onConflict: "venue_id,channel", ignoreDuplicates: false });
  if (error) throw error;
}
