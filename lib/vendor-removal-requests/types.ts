/**
 * Venue-facing requests to remove an event vendor assignment.
 * Couple unpick and vendor decline never delete assignments themselves.
 */
export type RemovalRequestRequester = "couple" | "vendor";
export type RemovalRequestStatus = "pending" | "approved" | "dismissed";

export type EventVendorRemovalRequest = {
  id: string;
  venueId: string;
  eventId: string;
  vendorId: string;
  assignmentId: string | null;
  requestedBy: RemovalRequestRequester;
  reason: string | null;
  status: RemovalRequestStatus;
  createdAt: string;
  resolvedAt: string | null;
};
