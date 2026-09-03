/**
 * Customer-facing copy derived from an experience profile.
 *
 * Presentation only — not a second resolver. Callers already have a profile
 * (from resolveExperienceProfile / PortalContext.experienceProfile).
 */

import type { ExperienceProfileDefinition } from "@/lib/event-experience/profiles";

export function homeLaunchHeading(profile: ExperienceProfileDefinition): string {
  return profile.customerExperienceTitle;
}

/** Exact wedding wording is preserved. Other profiles use locked titles. */
export function homeLaunchPrompt(profile: ExperienceProfileDefinition): string {
  if (profile.id === "wedding") {
    return "What would you like to work on for your wedding?";
  }
  if (profile.id === "celebration_of_life") {
    return "What would you like to work on for your celebration of life?";
  }
  if (profile.id === "anniversary") {
    return "What would you like to work on for your anniversary celebration?";
  }
  return "What would you like to work on for your event?";
}

/**
 * Hosted-site hero eyebrow. Wedding keeps "Wedding" (the previous null
 * default). Never interpolates a raw stored event_type.
 */
export function hostedHeroOccasionLabel(profile: ExperienceProfileDefinition): string {
  switch (profile.id) {
    case "wedding":
      return "Wedding";
    case "celebration_of_life":
      return "Celebration of Life";
    case "anniversary":
      return "Anniversary Celebration";
    case "corporate":
    case "general_event":
      return "Event";
  }
}

function hostOccasionName(profile: ExperienceProfileDefinition): string {
  switch (profile.id) {
    case "wedding":
      return "Wedding";
    case "celebration_of_life":
      return "Celebration of Life";
    case "anniversary":
      return "Anniversary Celebration";
    case "corporate":
    case "general_event":
      return "Event";
  }
}

export function rsvpDocumentTitle(hostName: string, profile: ExperienceProfileDefinition): string {
  return `RSVP — ${hostName}'s ${hostOccasionName(profile)}`;
}

export function rsvpDocumentDescription(hostName: string, profile: ExperienceProfileDefinition): string {
  if (profile.id === "wedding") {
    return `Submit your RSVP for ${hostName}'s wedding.`;
  }
  if (profile.id === "celebration_of_life") {
    return `Submit your RSVP for ${hostName}'s celebration of life.`;
  }
  if (profile.id === "anniversary") {
    return `Submit your RSVP for ${hostName}'s anniversary celebration.`;
  }
  return `Submit your RSVP for ${hostName}'s event.`;
}

export function rsvpWebsiteVisitLabel(hostName: string, profile: ExperienceProfileDefinition): string {
  if (profile.id === "wedding") {
    return `Visit ${hostName}'s wedding website →`;
  }
  if (profile.id === "celebration_of_life") {
    return `Visit ${hostName}'s celebration of life website →`;
  }
  if (profile.id === "anniversary") {
    return `Visit ${hostName}'s anniversary celebration website →`;
  }
  return `Visit ${hostName}'s event website →`;
}

export function rsvpWebsiteInlineLabel(profile: ExperienceProfileDefinition): string {
  if (profile.id === "wedding") {
    return "wedding website";
  }
  if (profile.id === "celebration_of_life") {
    return "celebration of life website";
  }
  if (profile.id === "anniversary") {
    return "anniversary celebration website";
  }
  return "event website";
}
