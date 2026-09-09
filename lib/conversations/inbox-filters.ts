/**
 * Pure Inbox filter helpers — active chips, clear-all, query assembly.
 */

export const INBOX_FILTER_ALL = "__all__";

export type InboxAttention = "all" | "unread" | "needs_response";
export type InboxRelationship = "all" | "leads" | "bookings";
export type InboxSort = "recent" | "oldest";
export type InboxAssignment =
  | { mode: "any" }
  | { mode: "unassigned" }
  | { mode: "me" }
  | { mode: "staff"; staffId: string };

export type InboxFilterState = {
  attention: InboxAttention;
  relationship: InboxRelationship;
  bookingStage: string; // INBOX_FILTER_ALL or stage key
  channel: string;
  assignment: InboxAssignment;
  eventId: string;
  eventDateFrom: string;
  eventDateTo: string;
  eventStatus: string;
  hasAttachments: boolean;
  sort: InboxSort;
};

export type InboxActiveChip = {
  id: string;
  label: string;
};

export function defaultInboxFilters(): InboxFilterState {
  return {
    attention: "all",
    relationship: "all",
    bookingStage: INBOX_FILTER_ALL,
    channel: INBOX_FILTER_ALL,
    assignment: { mode: "any" },
    eventId: INBOX_FILTER_ALL,
    eventDateFrom: "",
    eventDateTo: "",
    eventStatus: INBOX_FILTER_ALL,
    hasAttachments: false,
    sort: "recent",
  };
}

export function inboxFiltersAreDefault(state: InboxFilterState): boolean {
  const d = defaultInboxFilters();
  return (
    state.attention === d.attention
    && state.relationship === d.relationship
    && state.bookingStage === d.bookingStage
    && state.channel === d.channel
    && state.assignment.mode === d.assignment.mode
    && state.eventId === d.eventId
    && state.eventDateFrom === d.eventDateFrom
    && state.eventDateTo === d.eventDateTo
    && state.eventStatus === d.eventStatus
    && state.hasAttachments === d.hasAttachments
    && state.sort === d.sort
  );
}

const STAGE_LABELS: Record<string, string> = {
  package: "Package",
  agreement: "Agreement",
  deposit: "Deposit",
  booked: "Booked",
  planning: "Planning",
};

const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  sms: "Text",
  portal: "Portal",
  internal_note: "Internal note",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  confirmed: "Confirmed",
  in_progress: "In progress",
  complete: "Complete",
  cancelled: "Cancelled",
};

export function inboxActiveChips(
  state: InboxFilterState,
  opts?: { eventLabel?: string | null; staffLabel?: string | null },
): InboxActiveChip[] {
  const chips: InboxActiveChip[] = [];
  if (state.attention === "unread") chips.push({ id: "attention", label: "Unread" });
  if (state.attention === "needs_response") chips.push({ id: "attention", label: "Needs response" });
  if (state.relationship === "leads") chips.push({ id: "relationship", label: "Leads" });
  if (state.relationship === "bookings") chips.push({ id: "relationship", label: "Bookings" });
  if (state.bookingStage !== INBOX_FILTER_ALL) {
    chips.push({ id: "bookingStage", label: STAGE_LABELS[state.bookingStage] ?? state.bookingStage });
  }
  if (state.channel !== INBOX_FILTER_ALL) {
    chips.push({ id: "channel", label: CHANNEL_LABELS[state.channel] ?? state.channel });
  }
  if (state.assignment.mode === "unassigned") chips.push({ id: "assignment", label: "Unassigned" });
  if (state.assignment.mode === "me") chips.push({ id: "assignment", label: "Assigned to me" });
  if (state.assignment.mode === "staff") {
    chips.push({ id: "assignment", label: opts?.staffLabel ? `Assigned: ${opts.staffLabel}` : "Assigned" });
  }
  if (state.eventId !== INBOX_FILTER_ALL) {
    chips.push({ id: "eventId", label: opts?.eventLabel ? `Event: ${opts.eventLabel}` : "Event" });
  }
  if (state.eventDateFrom || state.eventDateTo) {
    const from = state.eventDateFrom || "…";
    const to = state.eventDateTo || "…";
    chips.push({ id: "eventDates", label: `Event dates ${from} → ${to}` });
  }
  if (state.eventStatus !== INBOX_FILTER_ALL) {
    chips.push({ id: "eventStatus", label: STATUS_LABELS[state.eventStatus] ?? state.eventStatus });
  }
  if (state.hasAttachments) chips.push({ id: "hasAttachments", label: "Has attachments" });
  if (state.sort === "oldest") chips.push({ id: "sort", label: "Oldest activity" });
  return chips;
}

export function clearInboxChip(state: InboxFilterState, chipId: string): InboxFilterState {
  switch (chipId) {
    case "attention":
      return { ...state, attention: "all" };
    case "relationship":
      return { ...state, relationship: "all" };
    case "bookingStage":
      return { ...state, bookingStage: INBOX_FILTER_ALL };
    case "channel":
      return { ...state, channel: INBOX_FILTER_ALL };
    case "assignment":
      return { ...state, assignment: { mode: "any" } };
    case "eventId":
      return { ...state, eventId: INBOX_FILTER_ALL };
    case "eventDates":
      return { ...state, eventDateFrom: "", eventDateTo: "" };
    case "eventStatus":
      return { ...state, eventStatus: INBOX_FILTER_ALL };
    case "hasAttachments":
      return { ...state, hasAttachments: false };
    case "sort":
      return { ...state, sort: "recent" };
    default:
      return state;
  }
}

export type InboxPageQueryFields = {
  unreadOnly: boolean;
  needsResponseOnly: boolean;
  relationship: InboxRelationship;
  channel: string | null;
  bookingStage: string | null;
  assignedStaffId: string | null;
  unassignedOnly: boolean;
  eventId: string | null;
  eventDateFrom: string | null;
  eventDateTo: string | null;
  eventStatus: string | null;
  hasAttachments: boolean;
  sort: InboxSort;
};

export function inboxFiltersToQuery(
  state: InboxFilterState,
  currentStaffId: string | null,
): InboxPageQueryFields {
  let assignedStaffId: string | null = null;
  let unassignedOnly = false;
  if (state.assignment.mode === "unassigned") unassignedOnly = true;
  else if (state.assignment.mode === "me") assignedStaffId = currentStaffId;
  else if (state.assignment.mode === "staff") assignedStaffId = state.assignment.staffId;

  return {
    unreadOnly: state.attention === "unread",
    needsResponseOnly: state.attention === "needs_response",
    relationship: state.relationship,
    channel: state.channel === INBOX_FILTER_ALL ? null : state.channel,
    bookingStage: state.bookingStage === INBOX_FILTER_ALL ? null : state.bookingStage,
    assignedStaffId,
    unassignedOnly,
    eventId: state.eventId === INBOX_FILTER_ALL ? null : state.eventId,
    eventDateFrom: state.eventDateFrom || null,
    eventDateTo: state.eventDateTo || null,
    eventStatus: state.eventStatus === INBOX_FILTER_ALL ? null : state.eventStatus,
    hasAttachments: state.hasAttachments,
    sort: state.sort,
  };
}
