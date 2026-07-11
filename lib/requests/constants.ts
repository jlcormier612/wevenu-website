import type { RequestStatus, RequestType, RequestVisibility } from "./types";

export const REQUEST_STATUSES: RequestStatus[] = [
  "draft", "sent", "viewed", "in_progress", "submitted", "reviewed", "completed", "cancelled",
];

export const STATUS_LABELS: Record<RequestStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  in_progress: "In Progress",
  submitted: "Submitted",
  reviewed: "Reviewed",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const REQUEST_TYPES: RequestType[] = [
  "document", "approval", "information", "selection", "upload", "confirmation", "task",
];

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  document: "Document",
  approval: "Approval",
  information: "Information",
  selection: "Selection",
  upload: "Upload",
  confirmation: "Confirmation",
  task: "Task",
};

export const VISIBILITY_OPTIONS: RequestVisibility[] = ["venue_only", "shared", "completed"];

export const VISIBILITY_LABELS: Record<RequestVisibility, string> = {
  venue_only: "Venue Only",
  shared: "Shared",
  completed: "Completed",
};

/** Statuses that carry a meaningful terminal timestamp on the Request row itself. */
export const TERMINAL_STATUS_TIMESTAMP_COLUMN: Partial<Record<RequestStatus, "completed_at" | "reviewed_at">> = {
  completed: "completed_at",
  reviewed: "reviewed_at",
};
