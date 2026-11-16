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
import { isLeadCaptureComplete } from "@/lib/setup-hub/stage-completion";
import type { BringYourBusinessPath, LeadCaptureChannelKey, LeadCaptureStageStatus, SetupHubState } from "@/lib/setup-hub/types";
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
    return { path: state.leadCapturePath, channels, complete: isLeadCaptureComplete(state.leadCapturePath, channels) };
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
  return setBringYourBusinessPath("skipped");
}

export async function setBringYourBusinessPath(path: BringYourBusinessPath): Promise<{ ok: boolean }> {
  const result = await withVenue(async (client, venueId) => {
    await repo.setBringYourBusinessPath(client, venueId, path);
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
 * Owner-declared Setup Hub signal: the venue is ready to invite couples.
 * Guidance and next-step presentation may use this. It does not hide
 * Dashboard, Calendar, Leads, or the rest of the operational workspace.
 */
export async function isVenueReadyToInviteCouples(venueId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const client = await createClient();
  return repo.getReadyToInviteCouples(client, venueId);
}

export async function markWelcomeExplored(): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await withVenue(async (client, venueId) => {
      await repo.markWelcomeExplored(client, venueId);
      return true;
    });
    return { ok: result === true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "mark_welcome_failed" };
  }
}

export async function setExistingBookingsAnswer(
  answer: "yes" | "no",
): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await withVenue(async (client, venueId) => {
      await repo.setExistingBookingsAnswer(client, venueId, answer);
      return true;
    });
    return { ok: result === true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "existing_bookings_failed" };
  }
}

export async function setHostedEventTypes(
  eventTypes: string[],
): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await withVenue(async (client, venueId) => {
      await repo.setHostedEventTypes(client, venueId, eventTypes);
      return true;
    });
    return { ok: result === true };
  } catch (e) {
    return { ok: false, error: repo.toCustomerFacingB1Error(e) };
  }
}

export async function confirmEventExperienceReview(
  eventType: string,
  review: {
    profileId: string;
    profileUpdatedAt: string;
    confirmedAt: string;
    resourcesReviewedAt?: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await withVenue(async (client, venueId) => {
      const state = await repo.getOrCreateState(client, venueId);
      await repo.confirmEventExperienceReview(
        client,
        venueId,
        eventType,
        review,
        state.eventExperienceReviews,
      );
      return true;
    });
    return { ok: result === true };
  } catch (e) {
    return { ok: false, error: repo.toCustomerFacingB1Error(e) };
  }
}

export async function confirmEventExperienceResourcesReviewed(
  eventType: string,
  review: { profileId: string; profileUpdatedAt: string; resourcesReviewedAt: string },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await withVenue(async (client, venueId) => {
      const state = await repo.getOrCreateState(client, venueId);
      const current = state.eventExperienceReviews[eventType];
      const sameSnapshot =
        current?.profileId === review.profileId &&
        current?.profileUpdatedAt === review.profileUpdatedAt;
      await repo.confirmEventExperienceReview(
        client,
        venueId,
        eventType,
        {
          profileId: review.profileId,
          profileUpdatedAt: review.profileUpdatedAt,
          confirmedAt: sameSnapshot && current?.confirmedAt ? current.confirmedAt : "",
          resourcesReviewedAt: review.resourcesReviewedAt,
        },
        state.eventExperienceReviews,
      );
      return true;
    });
    return { ok: result === true };
  } catch (e) {
    return { ok: false, error: repo.toCustomerFacingB1Error(e) };
  }
}

export async function markBookingProcessReviewed(): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await withVenue(async (client, venueId) => {
      await repo.markBookingProcessReviewed(client, venueId);
      return true;
    });
    return { ok: result === true };
  } catch (e) {
    return { ok: false, error: repo.toCustomerFacingB1Error(e) };
  }
}

export async function markCommunicationsReviewed(): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await withVenue(async (client, venueId) => {
      await repo.markCommunicationsReviewed(client, venueId);
      return true;
    });
    return { ok: result === true };
  } catch (e) {
    return { ok: false, error: repo.toCustomerFacingB1Error(e) };
  }
}

export async function markOperationalResourcesReviewed(
  choices: Record<string, "using" | "not_using">,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await withVenue(async (client, venueId) => {
      await repo.markOperationalResourcesReviewed(client, venueId, choices);
      return true;
    });
    return { ok: result === true };
  } catch (e) {
    return { ok: false, error: repo.toCustomerFacingB1Error(e) };
  }
}

export async function markBookingRulesReviewed(): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await withVenue(async (client, venueId) => {
      await repo.markBookingRulesReviewed(client, venueId);
      return true;
    });
    return { ok: result === true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "booking_rules_failed" };
  }
}
