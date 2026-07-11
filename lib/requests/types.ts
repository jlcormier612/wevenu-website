/**
 * Request Framework — shared platform domain.
 *
 * A Request is a reusable capability: the venue asking the client for
 * something and tracking it through a lifecycle. It is intentionally
 * generic — no feature (Planning, Documents, Contracts, Guest Management,
 * Floor Plans, Timeline, Website, Budget, ...) has feature-specific fields,
 * statuses, or types here. Those features will reference a Request by id
 * once they're ready to reuse this framework; none do yet.
 */

export type RequestStatus =
  | "draft" | "sent" | "viewed" | "in_progress"
  | "submitted" | "reviewed" | "completed" | "cancelled";

export type RequestType =
  | "document" | "approval" | "information" | "selection"
  | "upload" | "confirmation" | "task";

export type RequestVisibility = "venue_only" | "shared" | "completed";

// Which feature created this Request (Wedding Workspace – Request
// Experience, Phase 1) — mirrors event_tasks.source_type/source_id exactly.
// null means "created directly" (no originating feature, e.g. from the
// internal Request Center).
export type RequestSourceFeature =
  | "planning" | "timeline" | "documents" | "contracts" | "floor_plans" | "guests" | "manual";

export type Request = {
  id: string;
  venueId: string;
  clientId: string;   // one Client Workspace
  eventId: string | null; // one Booking (nullable — a client can exist before an event date is set)
  title: string;
  description: string | null;
  requestType: RequestType;
  status: RequestStatus;
  visibility: RequestVisibility;
  dueDate: string | null; // ISO "YYYY-MM-DD"
  requestedByUserId: string | null;
  assignedToStaffId: string | null;
  sourceFeature: RequestSourceFeature | null;
  sourceId: string | null;
  // What the client actually submitted — one generic pair for every type
  // (Information's answer, Upload's file, Approval/Confirmation/Selection's
  // decision) rather than a type-specific column each.
  responseText: string | null;
  responseFileUrl: string | null;
  clientActionEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  reviewedAt: string | null;
};

export type RequestInput = {
  clientId: string;
  eventId?: string | null;
  title: string;
  description?: string | null;
  requestType: RequestType;
  visibility?: RequestVisibility;
  dueDate?: string | null;
  assignedToStaffId?: string | null;
  sourceFeature?: RequestSourceFeature | null;
  sourceId?: string | null;
  clientActionEnabled?: boolean;
};

export type RequestLifecycleEventType = "created" | "status_changed" | "assigned" | "reassigned";

export type RequestLifecycleEventRecord = {
  id: string;
  requestId: string;
  eventType: RequestLifecycleEventType;
  fromStatus: RequestStatus | null;
  toStatus: RequestStatus | null;
  actorUserId: string | null;
  createdAt: string;
};

export type RequestActionResult =
  | { ok: true }
  | { ok: false; error: string };

// ---- Wedding Workspace (portal, token-scoped) shapes ----------------------

export type PortalRequestSummary = {
  id: string;
  title: string;
  description: string | null;
  requestType: RequestType;
  status: RequestStatus;
  visibility: RequestVisibility;
  dueDate: string | null;
  sourceFeature: RequestSourceFeature | null;
  clientActionEnabled: boolean;
  createdAt: string;
  completedAt: string | null;
};

export type PortalRequestHistoryEntry = {
  id: string;
  eventType: RequestLifecycleEventType;
  fromStatus: RequestStatus | null;
  toStatus: RequestStatus | null;
  createdAt: string;
};

export type PortalRequestDetail = PortalRequestSummary & {
  responseText: string | null;
  responseFileUrl: string | null;
  reviewedAt: string | null;
  history: PortalRequestHistoryEntry[];
};
