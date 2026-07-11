// Event Vendor Recommendations — Vendor Management, Next Iteration (2026-07-10).
// A recommendation is a distinct fact from an operational assignment
// (event_vendor_assignments): "here's a vendor we suggest for this couple to
// consider," made before any decision — never the same row as "this vendor
// is confirmed and working this event."

export type EventVendorRecommendation = {
  id: string;
  venueId: string;
  eventId: string;
  vendorId: string;
  note: string | null;
  recommendedAt: string;
  selectedAt: string | null;
  createdAt: string;
  // Denormalized for display — read-only, sourced from the vendor's own record.
  vendorName: string;
  vendorCategory: string | null;
};

export type RecommendationActionResult =
  | { ok: true }
  | { ok: false; message?: string };
