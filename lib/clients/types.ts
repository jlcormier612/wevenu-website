/**
 * Clients domain types (Sprint 9 — Clients module).
 * Intentionally separate from lead types: a booked couple represents a
 * different relationship phase, not a relabeled lead.
 */

import type { OccupancyCode } from "@/lib/availability/event-occupancy";

export type ClientStatus = "planning" | "confirmed" | "complete" | "cancelled";

export type Client = {
  id: string;
  venueId: string;
  leadId: string | null; // originating lead if converted, null if created directly
  status: ClientStatus;
  // Person 1
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  // Person 2 (partner)
  partnerFirstName: string | null;
  partnerLastName: string | null;
  partnerEmail: string | null;
  // Event
  eventType: string | null;
  eventDate: string | null; // ISO "YYYY-MM-DD"
  endDate: string | null;
  guestCount: number | null;
  ceremonyTime: string | null;  // "HH:MM"
  receptionTime: string | null; // "HH:MM"
  rehearsalDate: string | null;
  internalNotes: string | null;
  relationshipId: string | null; // Program 2 Phase 2 — the enduring customer identity, regardless of origin
  createdAt: string;
  updatedAt: string;
};

export type ClientNote = {
  id: string;
  venueId: string;
  clientId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};


export type ClientActivity = {
  id: string;
  venueId: string;
  clientId: string;
  type: string;
  title: string;
  description: string | null;
  createdAt: string;
};

export type ClientWithDetails = Client & {
  notes: ClientNote[];
  activities: ClientActivity[];
  /** ID of an event linked to this client, if one exists. */
  linkedEventId: string | null;
};

/** Form model — all fields as strings for controlled inputs. */
export type ClientInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  partnerFirstName: string;
  partnerLastName: string;
  partnerEmail: string;
  eventType: string;
  eventDate: string;
  endDate: string;
  guestCount: string;
  ceremonyTime: string;
  receptionTime: string;
  /** Operational setup start (HH:MM); used by Event creation when present. */
  setupTime: string;
  /** Operational teardown end (HH:MM); used by Event creation when present. */
  teardownTime: string;
  rehearsalDate: string;
  internalNotes: string;
  spaceId: string;
};


export type ClientErrors = Record<string, string>;

export type ClientActionResult =
  | { ok: true }
  | { ok: false; errors?: ClientErrors; message?: string };

export type CreateClientResult =
  | {
      ok: true;
      clientId: string;
      eventId: string | null;
      invitationSent: boolean;
      /** Present when Client/Event succeeded but a follow-on link (e.g. package) failed. */
      warning?: string;
    }
  | { ok: false; errors?: ClientErrors; message?: string; code?: OccupancyCode };
