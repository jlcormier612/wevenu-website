/**
 * Events domain types (Sprint 11 — Events module).
 *
 * An Event is the operational unit: the specific occasion taking place at the
 * venue. It is distinct from the Client (couple relationship) and Lead
 * (pre-booking). Vendors, timelines, and floor plans will attach to Events in
 * future sprints.
 *
 * Named VenueEvent to avoid conflict with the DOM Event type.
 */

export type EventStatus =
  | "draft"
  | "confirmed"
  | "in_progress"
  | "complete"
  | "cancelled";

export type VenueEvent = {
  id: string;
  venueId: string;
  clientId: string | null;
  spaceId: string | null;     // nullable FK to venue_spaces (Sprint 20)
  status: EventStatus;
  name: string;
  eventType: string | null;
  eventDate: string; // ISO "YYYY-MM-DD"
  startTime: string | null;   // "HH:MM"
  endTime: string | null;
  setupTime: string | null;
  teardownTime: string | null;
  guestCount: number | null;
  createdAt: string;
  updatedAt: string;
};

export type EventNote = {
  id: string;
  venueId: string;
  eventId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type EventTeamMember = {
  id: string;
  venueId: string;
  eventId: string;
  fullName: string;
  role: string | null;
  phone: string | null;
  createdAt: string;
};

export type EventActivity = {
  id: string;
  venueId: string;
  eventId: string;
  type: string;
  title: string;
  description: string | null;
  createdAt: string;
};

/** Event with all related data for the detail page. */
export type EventWithDetails = VenueEvent & {
  clientName: string | null; // embedded from client join
  notes: EventNote[];
  team: EventTeamMember[];
  activities: EventActivity[];
  timeline: import("@/lib/timeline/types").TimelineEntry[];
  vendorAssignments: import("@/lib/vendors/types").EventVendorAssignment[];
  floorPlan: import("@/lib/floor-plans/types").FloorPlanWithObjects | null;
};

/** Form model for create and edit. */
export type EventInput = {
  name: string;
  eventType: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  setupTime: string;
  teardownTime: string;
  guestCount: string;
  clientId: string;
  spaceId: string;   // empty string = no space assigned
};

export type TeamMemberInput = {
  fullName: string;
  role: string;
  phone: string;
};

export type EventErrors = Record<string, string>;

export type EventActionResult =
  | { ok: true }
  | { ok: false; errors?: EventErrors; message?: string };

export type CreateEventResult =
  | { ok: true; eventId: string }
  | { ok: false; errors?: EventErrors; message?: string };
