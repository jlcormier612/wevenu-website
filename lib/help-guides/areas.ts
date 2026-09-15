/**
 * Help & Guides — task-oriented areas.
 * Category order is locked by the Help & Guides final implementation brief.
 * Stored as success_library_articles.goal_category (canonical content store).
 */

import {
  FINAL_HELP_CATEGORY_ORDER,
  HELP_GUIDES_LANDING_TAGLINE,
} from "@/lib/help-guides/final-articles";

export type HelpGuideAreaId =
  | "getting_started"
  | "your_venue"
  | "finding_booking_clients"
  | "working_with_clients"
  | "contracts_payments"
  | "building_the_event"
  | "planning_the_event"
  | "vendors"
  | "event_day"
  | "reports"
  | "after_the_event";

export type HelpGuideArea = {
  id: HelpGuideAreaId;
  /** Exact string stored in success_library_articles.goal_category */
  category: string;
  description: string;
};

const AREA_META: Record<string, { id: HelpGuideAreaId; description: string }> = {
  "Getting Started": { id: "getting_started", description: "Get comfortable with the essentials." },
  "Your Venue": { id: "your_venue", description: "Branding, settings, and how your venue shows up." },
  "Finding & Booking Clients": { id: "finding_booking_clients", description: "Move inquiries from first conversation to booked event." },
  "Working With Clients": { id: "working_with_clients", description: "Stay connected and keep planning moving." },
  "Contracts & Payments": { id: "contracts_payments", description: "Agreements, invoices, and getting paid." },
  "Building the Event": { id: "building_the_event", description: "Packages, floor plans, and inventory." },
  "Planning the Event": { id: "planning_the_event", description: "Questionnaires, timelines, and planning work." },
  "Vendors": { id: "vendors", description: "Your network and how you work together." },
  "Event Day": { id: "event_day", description: "Day sheets and day-of coordination." },
  "Reports": { id: "reports", description: "Understand how your venue is performing." },
  "After the Event": { id: "after_the_event", description: "Feedback and closeout." },
};

export const HELP_GUIDE_AREAS: readonly HelpGuideArea[] = FINAL_HELP_CATEGORY_ORDER.map((category) => {
  const meta = AREA_META[category];
  return { id: meta.id, category, description: meta.description };
});

export const HELP_GUIDE_CATEGORY_NAMES = HELP_GUIDE_AREAS.map((a) => a.category);

export function isHelpGuideCategory(value: string): boolean {
  return HELP_GUIDE_CATEGORY_NAMES.includes(value);
}

/** Customer-facing product name. */
export const HELP_GUIDES_TITLE = "Help & Guides";
export const HELP_GUIDES_TAGLINE = HELP_GUIDES_LANDING_TAGLINE;
export const HELP_GUIDES_HOME_HREF = "/help";
