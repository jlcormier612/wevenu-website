/**
 * Event Experience Profiles — presentation families for the customer Event Experience.
 *
 * event_type (domain classification) is not the same as experience_profile
 * (presentation family). Callers resolve:
 *   event_type → experience_profile → customer presentation
 *
 * Do not scatter independent event_type conditionals through the customer
 * experience. Consume this module instead.
 *
 * This is the profile catalog, not a configuration CMS. Extra per-profile
 * presentation can be added here later without a second mapping system.
 */

export const EXPERIENCE_PROFILE_IDS = [
  "wedding",
  "celebration_of_life",
  "anniversary",
  "corporate",
  "general_event",
] as const;

export type ExperienceProfileId = (typeof EXPERIENCE_PROFILE_IDS)[number];

export type ExperienceProfileDefinition = {
  id: ExperienceProfileId;
  /** Internal / staff name. Not necessarily shown to customers. */
  internalLabel: string;
  /**
   * Default customer-facing experience title.
   * General Event must never surface as "General Event".
   */
  customerExperienceTitle: string;
  isWeddingSpecific: boolean;
};

export const EXPERIENCE_PROFILES: Record<ExperienceProfileId, ExperienceProfileDefinition> = {
  wedding: {
    id: "wedding",
    internalLabel: "Wedding",
    customerExperienceTitle: "Your Wedding",
    isWeddingSpecific: true,
  },
  celebration_of_life: {
    id: "celebration_of_life",
    internalLabel: "Celebration of Life",
    customerExperienceTitle: "Your Celebration of Life",
    isWeddingSpecific: false,
  },
  anniversary: {
    id: "anniversary",
    internalLabel: "Anniversary",
    customerExperienceTitle: "Your Anniversary Celebration",
    isWeddingSpecific: false,
  },
  corporate: {
    id: "corporate",
    internalLabel: "Corporate",
    // Customer-facing title is "Your Event" (locked). Do not introduce
    // "Your Corporate Event" unless explicitly directed later.
    customerExperienceTitle: "Your Event",
    isWeddingSpecific: false,
  },
  general_event: {
    id: "general_event",
    internalLabel: "General Event",
    customerExperienceTitle: "Your Event",
    isWeddingSpecific: false,
  },
};

export const FALLBACK_EXPERIENCE_PROFILE_ID: ExperienceProfileId = "general_event";
