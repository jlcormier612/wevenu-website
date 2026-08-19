/**
 * Setup Hub — Continuous Setup Experience.
 * Spec: docs/continuous-setup-experience-implementation-plan.md.
 *
 * Deliberately does not touch venues.setup_completed / onboarding_dismissed
 * / setup_last_step — those remain scoped to the pre-workspace wizard only.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import * as repo from "@/lib/setup-hub/repository";
import { CHANNEL_HAS_VERIFICATION } from "@/lib/setup-hub/types";
import type { LeadCaptureChannelKey, LeadCaptureStageStatus, SetupHubState } from "@/lib/setup-hub/types";
import { getCurrentVenue } from "@/lib/venue/service";

async function withVenue<T>(fn: (client: Awaited<ReturnType<typeof createClient>>, venueId: string) => Promise<T>): Promise<T | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return fn(await createClient(), venue.id);
}

export async function getSetupHubState(): Promise<SetupHubState | null> {
  return withVenue((client, venueId) => repo.getOrCreateState(client, venueId));
}

export async function getLeadCaptureStageStatus(): Promise<LeadCaptureStageStatus | null> {
  return withVenue(async (client, venueId) => {
    const [state, channels] = await Promise.all([
      repo.getOrCreateState(client, venueId),
      repo.getLeadCaptureChannels(client, venueId),
    ]);
    return { path: state.leadCapturePath, channels, complete: computeLeadCaptureComplete(state.leadCapturePath, channels) };
  });
}

/**
 * Approved completion model (plan §D), applied literally:
 * "A. The venue configures and, where applicable, verifies at least one
 * automated intake channel they intend to use. OR B. The venue explicitly
 * chooses a valid manual/external workflow for now."
 *
 * A channel counts toward (A) only when it's configured AND — for channels
 * where an on-demand verify action is practical (CHANNEL_HAS_VERIFICATION)
 * — also verified. For channels with no practical verify path (manual,
 * QR scan-dependent), configuration alone is the bar.
 */
function computeLeadCaptureComplete(
  path: SetupHubState["leadCapturePath"],
  channels: LeadCaptureStageStatus["channels"],
): boolean {
  if (path === "manual_external") return true;
  if (path !== "automated") return false;
  return channels.some((c) => {
    if (!c.configuredAt) return false;
    if (CHANNEL_HAS_VERIFICATION[c.channel]) return c.verifiedAt != null;
    return true;
  });
}

export async function markChannelConfigured(channel: LeadCaptureChannelKey): Promise<{ ok: boolean }> {
  const result = await withVenue(async (client, venueId) => {
    await repo.markChannelConfigured(client, venueId, channel);
    return true;
  });
  return { ok: result === true };
}

export async function markChannelVerified(channel: LeadCaptureChannelKey): Promise<{ ok: boolean }> {
  const result = await withVenue(async (client, venueId) => {
    await repo.markChannelVerified(client, venueId, channel);
    return true;
  });
  return { ok: result === true };
}

export async function setLeadCapturePath(path: "automated" | "manual_external"): Promise<{ ok: boolean }> {
  const result = await withVenue(async (client, venueId) => {
    await repo.setLeadCapturePath(client, venueId, path);
    return true;
  });
  return { ok: result === true };
}

export async function markStageReviewed(
  stage: "your-venue" | "calendar-availability" | "your-offerings" | "client-experience" | "financials",
): Promise<{ ok: boolean }> {
  const columnByStage = {
    "your-venue": "your_venue_reviewed_at",
    "calendar-availability": "calendar_availability_reviewed_at",
    "your-offerings": "your_offerings_reviewed_at",
    "client-experience": "client_experience_reviewed_at",
    financials: "financials_reviewed_at",
  } as const;
  const result = await withVenue(async (client, venueId) => {
    await repo.markStageReviewed(client, venueId, columnByStage[stage]);
    return true;
  });
  return { ok: result === true };
}

export async function setBringYourBusinessManual(): Promise<{ ok: boolean }> {
  const result = await withVenue(async (client, venueId) => {
    await repo.setBringYourBusinessManual(client, venueId);
    return true;
  });
  return { ok: result === true };
}

export async function setYourTeamSolo(): Promise<{ ok: boolean }> {
  const result = await withVenue(async (client, venueId) => {
    await repo.setYourTeamSolo(client, venueId);
    return true;
  });
  return { ok: result === true };
}

export async function setReadyToInviteCouples(ready: boolean): Promise<{ ok: boolean }> {
  const result = await withVenue(async (client, venueId) => {
    const { data: { user } } = await client.auth.getUser();
    await repo.setReadyToInviteCouples(client, venueId, ready, user?.id ?? null);
    return true;
  });
  return { ok: result === true };
}

/**
 * Setup Hub -> Dashboard graduation signal. Takes venueId directly (not the
 * withVenue "current user's venue" pattern) since callers — the app layout
 * gate and the dashboard's own data guard — already have the venue from
 * their own getCurrentVenue() call and would otherwise redo it.
 */
export async function isVenueReadyToInviteCouples(venueId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const client = await createClient();
  return repo.getReadyToInviteCouples(client, venueId);
}
