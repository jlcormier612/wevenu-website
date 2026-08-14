/**
 * Help & Guides — task-oriented areas (Phase 1).
 * Source: docs/help-guides-information-architecture.md
 * Stored as success_library_articles.goal_category (canonical content store).
 */

export type HelpGuideAreaId =
  | "getting_started"
  | "finding_booking_clients"
  | "working_with_clients"
  | "contracts_payments"
  | "planning_the_event"
  | "building_the_event"
  | "event_day"
  | "after_the_event"
  | "vendors"
  | "your_venue"
  | "reports"
  | "guided_journeys";

export type HelpGuideArea = {
  id: HelpGuideAreaId;
  /** Exact string stored in success_library_articles.goal_category */
  category: string;
  description: string;
};

export const HELP_GUIDE_AREAS: readonly HelpGuideArea[] = [
  { id: "getting_started", category: "Getting Started", description: "Get comfortable with the essentials." },
  { id: "finding_booking_clients", category: "Finding & Booking Clients", description: "Move inquiries from first conversation to booked event." },
  { id: "working_with_clients", category: "Working With Clients", description: "Stay connected and keep planning moving." },
  { id: "contracts_payments", category: "Contracts & Payments", description: "Agreements, invoices, and getting paid." },
  { id: "planning_the_event", category: "Planning the Event", description: "Questionnaires, timelines, and playbooks." },
  { id: "building_the_event", category: "Building the Event", description: "Packages, floor plans, inventory, and event orders." },
  { id: "event_day", category: "Event Day", description: "Day sheets and day-of coordination." },
  { id: "after_the_event", category: "After the Event", description: "Feedback, reviews, and closeout." },
  { id: "vendors", category: "Vendors", description: "Your network and how you work together." },
  { id: "your_venue", category: "Your Venue", description: "Branding, guide, settings, and integrations." },
  { id: "reports", category: "Reports", description: "Understand how your venue is performing." },
  { id: "guided_journeys", category: "Guided Journeys", description: "Multi-step paths across Hello to Cheers." },
] as const;

export const HELP_GUIDE_CATEGORY_NAMES = HELP_GUIDE_AREAS.map((a) => a.category);

export function isHelpGuideCategory(value: string): boolean {
  return HELP_GUIDE_CATEGORY_NAMES.includes(value);
}

/** Customer-facing product name. */
export const HELP_GUIDES_TITLE = "Help & Guides";
export const HELP_GUIDES_TAGLINE = "Quick answers for using Hello to Cheers.";
export const HELP_GUIDES_HOME_HREF = "/help";
