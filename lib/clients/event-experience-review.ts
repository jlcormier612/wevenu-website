/**
 * Phase 6 Event Experience review — presentation only.
 *
 * Displays the existing resolver + presentation result. Does not persist,
 * publish, or change event type, website, planning, or invitation.
 */

import {
  homeLaunchHeading,
  homeLaunchPrompt,
  resolveExperienceProfileForClientEvent,
} from "@/lib/event-experience";
import { eventTypeLabel } from "@/lib/clients/constants";

export type EventExperienceReviewRow = {
  key: "experience" | "event_type" | "client_will_see";
  label: string;
  detail: string;
  href: string;
  actionLabel: string;
};

export type EventExperienceReviewModel = {
  heading: string;
  experienceName: string;
  summary: string;
  reviewNote: string;
  customerTitle: string;
  rows: EventExperienceReviewRow[];
};

export const EVENT_EXPERIENCE_REVIEW_NOTE =
  "Opening this page does not change their experience. A hosted website is not created here.";

function reviewHref(clientId: string, eventId: string | null): string {
  return eventId ? `/events/${eventId}` : `/clients/${clientId}`;
}

function reviewActionLabel(eventId: string | null): string {
  return eventId ? "Open Event" : "View Client";
}

function venueSummary(isWeddingSpecific: boolean, experienceName: string): string {
  if (isWeddingSpecific) {
    return "Your client's experience is set up for a wedding.";
  }
  return `This event will use the ${experienceName} experience.`;
}

export function buildEventExperienceReview(input: {
  clientId: string;
  eventId: string | null;
  eventType: string | null | undefined;
  clientEventType?: string | null;
}): EventExperienceReviewModel {
  const profile = resolveExperienceProfileForClientEvent(input.eventType, input.clientEventType);
  const preferredType =
    input.eventType != null && input.eventType.trim() !== ""
      ? input.eventType
      : input.clientEventType;
  const typeLabel = eventTypeLabel(preferredType ?? null) || "Not set";
  const href = reviewHref(input.clientId, input.eventId);
  const actionLabel = reviewActionLabel(input.eventId);
  const customerTitle = homeLaunchHeading(profile);
  const summary = venueSummary(profile.isWeddingSpecific, profile.internalLabel);

  return {
    heading: "Event Experience",
    experienceName: profile.internalLabel,
    summary,
    reviewNote: EVENT_EXPERIENCE_REVIEW_NOTE,
    customerTitle,
    rows: [
      {
        key: "experience",
        label: "Experience",
        detail: summary,
        href,
        actionLabel,
      },
      {
        key: "event_type",
        label: "Event type",
        detail: typeLabel,
        href,
        actionLabel,
      },
      {
        key: "client_will_see",
        label: "Client will see",
        detail: `${customerTitle}. ${homeLaunchPrompt(profile)}`,
        href,
        actionLabel,
      },
    ],
  };
}
