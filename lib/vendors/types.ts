/**
 * Vendor domain types (Sprint 14 — Vendor Management).
 */

export type VendorPreferenceLevel = "featured" | "preferred" | "recommended";
export type VendorPricingTier = "budget" | "moderate" | "luxury";

export type Vendor = {
  id: string;
  venueId: string;
  name: string;
  category: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  pinterestUrl: string | null;
  tiktokUrl: string | null;
  isPreferred: boolean;
  preferenceLevel: VendorPreferenceLevel;
  description: string | null;
  photoUrl: string | null;
  pricingTier: VendorPricingTier | null;
  displayOrder: number;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Couple-facing vendor shape — no internal notes, sorted by venue preference. */
export type PortalVendor = {
  id: string;
  name: string;
  category: string | null;
  preferenceLevel: VendorPreferenceLevel;
  description: string | null;
  photoUrl: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
  pricingTier: VendorPricingTier | null;
  email: string | null;
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
  arrivalTime: string | null;    // "HH:MM"
  setupLocation: string | null;
  loadInNotes: string | null;
  notes: string | null;
  // Check-in state (set by coordinator or vendor self-check-in)
  checkedInAt: string | null;
  setupCompleteAt: string | null;
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
  instagramUrl: string;
  facebookUrl: string;
  pinterestUrl: string;
  tiktokUrl: string;
  isPreferred: boolean;
  preferenceLevel: VendorPreferenceLevel;
  description: string;
  photoUrl: string;
  pricingTier: string;
  notes: string;
};

export type VendorAssignmentInput = {
  vendorId: string;
  arrivalTime: string;
  setupLocation: string;
  loadInNotes: string;
  notes: string;
};

export type VendorErrors = Record<string, string>;

export type VendorActionResult =
  | { ok: true }
  | { ok: false; errors?: VendorErrors; message?: string };

export type CreateVendorResult =
  | { ok: true; vendorId: string }
  | { ok: false; errors?: VendorErrors; message?: string };
