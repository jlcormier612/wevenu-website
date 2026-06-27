/**
 * Vendor domain types (Sprint 14 — Vendor Management).
 */

export type Vendor = {
  id: string;
  venueId: string;
  name: string;
  category: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  isPreferred: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

/** A vendor assigned to a specific event, with event-specific details. */
export type EventVendorAssignment = {
  id: string;
  venueId: string;
  eventId: string;
  vendorId: string;
  // Embedded vendor fields for quick display
  vendorName: string;
  vendorCategory: string | null;
  vendorPhone: string | null;
  // Event-specific
  arrivalTime: string | null; // "HH:MM"
  notes: string | null;
  createdAt: string;
};

/** Vendor with their event assignment history. */
export type VendorWithEvents = Vendor & {
  assignments: VendorEventSummary[];
};

export type VendorEventSummary = {
  id: string; // assignment id
  eventId: string;
  eventName: string;
  eventDate: string | null;
  arrivalTime: string | null;
};

export type VendorInput = {
  name: string;
  category: string;
  contactName: string;
  email: string;
  phone: string;
  website: string;
  isPreferred: boolean;
  notes: string;
};

export type VendorAssignmentInput = {
  vendorId: string;
  arrivalTime: string;
  notes: string;
};

export type VendorErrors = Record<string, string>;

export type VendorActionResult =
  | { ok: true }
  | { ok: false; errors?: VendorErrors; message?: string };

export type CreateVendorResult =
  | { ok: true; vendorId: string }
  | { ok: false; errors?: VendorErrors; message?: string };
