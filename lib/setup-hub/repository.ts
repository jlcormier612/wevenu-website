/**
 * Setup Hub data access layer. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import {
  parseEventExperienceReviews,
  parseOperationalResourceChoices,
} from "@/lib/setup-hub/phase-b1-readiness";
import { normalizeHostedEventTypes } from "@/lib/setup-hub/phase-b1-event-types";
import type {
  BringYourBusinessPath,
  ExistingBookingsAnswer,
  LeadCaptureChannelKey,
  LeadCaptureChannelState,
  SetupHubState,
} from "@/lib/setup-hub/types";

export const PHASE_B1_SCHEMA_MISSING =
  "We couldn't save that yet. Please try again in a moment.";

export function toCustomerFacingB1Error(error: unknown, fallback = PHASE_B1_SCHEMA_MISSING): string {
  const message = error instanceof Error ? error.message : "";
  if (message === PHASE_B1_SCHEMA_MISSING) return message;
  if (
    message &&
    !/column|postgres|42703|hosted_event_types|event_experience_reviews|booking_process_reviewed_at|communications_reviewed_at|operational_resources/i.test(
      message,
    )
  ) {
    return message;
  }
  return fallback;
}

type DbClient = Awaited<ReturnType<typeof createClient>>;

type StateRow = {
  venue_id: string;
  onboarding_type: "self_setup" | "white_glove";
  your_venue_reviewed_at: string | null;
  calendar_availability_reviewed_at: string | null;
  bring_your_business_manual_confirmed_at: string | null;
  bring_your_business_path: BringYourBusinessPath | null;
  your_offerings_reviewed_at: string | null;
  client_experience_reviewed_at: string | null;
  lead_capture_path: "automated" | "manual_external" | null;
  lead_capture_path_decided_at: string | null;
  your_team_solo_confirmed_at: string | null;
  financials_reviewed_at: string | null;
  ready_to_invite_couples: boolean;
  ready_to_invite_couples_at: string | null;
  welcome_explored_at: string | null;
  existing_bookings_answer: ExistingBookingsAnswer | null;
  existing_bookings_answered_at: string | null;
  booking_rules_reviewed_at: string | null;
  hosted_event_types?: string[] | null;
  hosted_event_types_set_at?: string | null;
  event_experience_reviews?: unknown;
  booking_process_reviewed_at?: string | null;
  communications_reviewed_at?: string | null;
  operational_resources_reviewed_at?: string | null;
  operational_resource_choices?: unknown;
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
  bringYourBusinessPath: r.bring_your_business_path === "individual" || r.bring_your_business_path === "skipped"
    ? r.bring_your_business_path
    : (r.bring_your_business_manual_confirmed_at ? "skipped" : null),
  yourOfferingsReviewedAt: r.your_offerings_reviewed_at,
  clientExperienceReviewedAt: r.client_experience_reviewed_at,
  leadCapturePath: r.lead_capture_path,
  leadCapturePathDecidedAt: r.lead_capture_path_decided_at,
  yourTeamSoloConfirmedAt: r.your_team_solo_confirmed_at,
  financialsReviewedAt: r.financials_reviewed_at,
  readyToInviteCouples: r.ready_to_invite_couples,
  readyToInviteCouplesAt: r.ready_to_invite_couples_at,
  welcomeExploredAt: r.welcome_explored_at ?? null,
  existingBookingsAnswer:
    r.existing_bookings_answer === "yes" || r.existing_bookings_answer === "no"
      ? r.existing_bookings_answer
      : null,
  existingBookingsAnsweredAt: r.existing_bookings_answered_at ?? null,
  // Prefer Phase A column; fall back to calendar stage review until migration is applied.
  bookingRulesReviewedAt:
    r.booking_rules_reviewed_at ?? r.calendar_availability_reviewed_at ?? null,
  hostedEventTypes: Array.isArray(r.hosted_event_types)
    ? normalizeHostedEventTypes(r.hosted_event_types)
    : null,
  hostedEventTypesSetAt: r.hosted_event_types_set_at ?? null,
  eventExperienceReviews: parseEventExperienceReviews(r.event_experience_reviews),
  bookingProcessReviewedAt: r.booking_process_reviewed_at ?? null,
  communicationsReviewedAt: r.communications_reviewed_at ?? null,
  operationalResourcesReviewedAt: r.operational_resources_reviewed_at ?? null,
  operationalResourceChoices: parseOperationalResourceChoices(r.operational_resource_choices),
});

const mapChannel = (r: ChannelRow): LeadCaptureChannelState => ({
  channel: r.channel,
  configuredAt: r.configured_at,
  verifiedAt: r.verified_at,
});

/**
 * Row-existence is never itself a signal here — every column defaults to
 * null/false.
 *
 * Setup Hub's own page fires getSetupHubState() and
 * getLeadCaptureStageStatus() concurrently (same Promise.all), and both
 * call this — so for a venue's very first load, two requests can both see
 * no row and both attempt the insert. Postgres's unique constraint on
 * venue_id correctly rejects the loser, but that showed up as an unhandled
 * 23505 crashing the page (blank render) instead of the harmless race it
 * actually is. Treat that one error code as "someone else just created it"
 * and re-read, rather than as a real failure.
 */
export async function getOrCreateState(client: DbClient, venueId: string, onboardingType: "self_setup" | "white_glove" = "self_setup"): Promise<SetupHubState> {
  const { data, error } = await client.from("venue_setup_hub_state").select("*").eq("venue_id", venueId).maybeSingle<StateRow>();
  if (error) throw error;
  if (data) return mapState(data);

  const { data: created, error: insertError } = await client.from("venue_setup_hub_state")
    .insert({ venue_id: venueId, onboarding_type: onboardingType })
    .select("*").single<StateRow>();
  if (insertError) {
    if (insertError.code === "23505") {
      const { data: existing, error: refetchError } = await client
        .from("venue_setup_hub_state").select("*").eq("venue_id", venueId).single<StateRow>();
      if (refetchError) throw refetchError;
      return mapState(existing);
    }
    throw insertError;
  }
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
  await setBringYourBusinessPath(client, venueId, "skipped");
}

export async function setBringYourBusinessPath(
  client: DbClient,
  venueId: string,
  path: BringYourBusinessPath,
): Promise<void> {
  const { error } = await client.from("venue_setup_hub_state")
    .update({
      bring_your_business_path: path,
      bring_your_business_manual_confirmed_at: new Date().toISOString(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
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

/**
 * Plain read, no create-on-missing side effect — used by Setup Hub's
 * reversible "ready to invite couples" declaration. No row yet means the
 * venue has never declared readiness, which is correctly "not ready"
 * (default false), not an error. This flag does not gate the workspace.
 */
export async function getReadyToInviteCouples(client: DbClient, venueId: string): Promise<boolean> {
  const { data, error } = await client.from("venue_setup_hub_state")
    .select("ready_to_invite_couples").eq("venue_id", venueId).maybeSingle<{ ready_to_invite_couples: boolean }>();
  if (error) throw error;
  return data?.ready_to_invite_couples === true;
}

export async function markWelcomeExplored(client: DbClient, venueId: string): Promise<void> {
  const { error } = await client.from("venue_setup_hub_state")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ welcome_explored_at: new Date().toISOString() } as any)
    .eq("venue_id", venueId);
  if (error) {
    // Phase A migration not applied yet — surface clearly to callers.
    throw Object.assign(error, {
      message:
        error.message?.includes("welcome_explored_at")
          ? "Phase A schema not applied: welcome_explored_at missing on venue_setup_hub_state"
          : error.message,
    });
  }
}

export async function setExistingBookingsAnswer(
  client: DbClient,
  venueId: string,
  answer: ExistingBookingsAnswer,
): Promise<void> {
  const { error } = await client.from("venue_setup_hub_state")
    .update({
      existing_bookings_answer: answer,
      existing_bookings_answered_at: new Date().toISOString(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    .eq("venue_id", venueId);
  if (error) {
    throw Object.assign(error, {
      message:
        error.message?.includes("existing_bookings_answer")
          ? "Phase A schema not applied: existing_bookings_answer missing on venue_setup_hub_state"
          : error.message,
    });
  }
}

function isMissingColumnError(error: { code?: string; message?: string } | null, column: string): boolean {
  if (!error) return false;
  return error.code === "42703" || Boolean(error.message?.includes(column));
}

export async function setHostedEventTypes(
  client: DbClient,
  venueId: string,
  eventTypes: string[],
): Promise<void> {
  const hosted = normalizeHostedEventTypes(eventTypes);
  const { error } = await client.from("venue_setup_hub_state")
    .update({
      hosted_event_types: hosted,
      hosted_event_types_set_at: new Date().toISOString(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    .eq("venue_id", venueId);
  if (error) {
    throw Object.assign(error, {
      message: isMissingColumnError(error, "hosted_event_types")
        ? PHASE_B1_SCHEMA_MISSING
        : error.message,
    });
  }
}

export async function confirmEventExperienceReview(
  client: DbClient,
  venueId: string,
  eventType: string,
  review: { profileId: string; profileUpdatedAt: string; confirmedAt: string },
  currentReviews: SetupHubState["eventExperienceReviews"],
): Promise<void> {
  const next = { ...currentReviews, [eventType]: review };
  const { error } = await client.from("venue_setup_hub_state")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ event_experience_reviews: next } as any)
    .eq("venue_id", venueId);
  if (error) {
    throw Object.assign(error, {
      message: isMissingColumnError(error, "event_experience_reviews")
        ? PHASE_B1_SCHEMA_MISSING
        : error.message,
    });
  }
}

export async function markBookingProcessReviewed(client: DbClient, venueId: string): Promise<void> {
  const { error } = await client.from("venue_setup_hub_state")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ booking_process_reviewed_at: new Date().toISOString() } as any)
    .eq("venue_id", venueId);
  if (error) {
    throw Object.assign(error, {
      message: isMissingColumnError(error, "booking_process_reviewed_at")
        ? PHASE_B1_SCHEMA_MISSING
        : error.message,
    });
  }
}

export async function markCommunicationsReviewed(client: DbClient, venueId: string): Promise<void> {
  const { error } = await client.from("venue_setup_hub_state")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ communications_reviewed_at: new Date().toISOString() } as any)
    .eq("venue_id", venueId);
  if (error) {
    throw Object.assign(error, {
      message: isMissingColumnError(error, "communications_reviewed_at")
        ? PHASE_B1_SCHEMA_MISSING
        : error.message,
    });
  }
}

export async function markOperationalResourcesReviewed(
  client: DbClient,
  venueId: string,
  choices: SetupHubState["operationalResourceChoices"],
): Promise<void> {
  const { error } = await client.from("venue_setup_hub_state")
    .update({
      operational_resources_reviewed_at: new Date().toISOString(),
      operational_resource_choices: choices,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    .eq("venue_id", venueId);
  if (error) {
    throw Object.assign(error, {
      message: isMissingColumnError(error, "operational_resources_reviewed_at")
        ? PHASE_B1_SCHEMA_MISSING
        : error.message,
    });
  }
}

export async function markBookingRulesReviewed(client: DbClient, venueId: string): Promise<void> {
  const now = new Date().toISOString();
  // Dual-write: Phase A column when present; always set calendar_availability_reviewed_at
  // so readiness works before the Phase A migration is applied to Sandbox.
  const { error: primaryError } = await client.from("venue_setup_hub_state")
    .update({
      booking_rules_reviewed_at: now,
      calendar_availability_reviewed_at: now,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    .eq("venue_id", venueId);
  if (!primaryError) return;
  const { error: fallbackError } = await client.from("venue_setup_hub_state")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ calendar_availability_reviewed_at: now } as any)
    .eq("venue_id", venueId);
  if (fallbackError) throw fallbackError;
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
