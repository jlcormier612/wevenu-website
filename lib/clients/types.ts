/**
 * Clients domain types (Sprint 9 — Clients module).
 * Intentionally separate from lead types: a booked couple represents a
 * different relationship phase, not a relabeled lead.
 */

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

export type ClientKeyDate = {
  id: string;
  venueId: string;
  clientId: string;
  label: string;
  date: string; // ISO "YYYY-MM-DD"
  note: string | null;
  createdAt: string;
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
  keyDates: ClientKeyDate[];
  activities: ClientActivity[];
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
  rehearsalDate: string;
  internalNotes: string;
};

export type KeyDateInput = {
  label: string;
  date: string;
  note: string;
};

export type ClientErrors = Record<string, string>;

export type ClientActionResult =
  | { ok: true }
  | { ok: false; errors?: ClientErrors; message?: string };

export type CreateClientResult =
  | { ok: true; clientId: string }
  | { ok: false; errors?: ClientErrors; message?: string };
