/**
 * Pure Inbox filter helpers — active chips, clear-all, query assembly,
 * event-date presets. Event filter = attributes first; specific event is secondary.
 */

import { EVENT_TYPES, eventTypeLabel } from "@/lib/event-types/canonical";

export const INBOX_FILTER_ALL = "__all__";

export type InboxAttention = "all" | "unread" | "needs_response";
export type InboxRelationship = "all" | "leads" | "bookings";

export type InboxSort =
  | "recent"
  | "oldest"
  | "event_date_asc"
  | "event_date_desc"
  | "client_name_asc"
  | "client_name_desc";

export type InboxEventDatePreset =
  | "any"
  | "past"
  | "today"
  | "next_7"
  | "next_30"
  | "this_month"
  | "next_month"
  | "this_year"
  | "custom";

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
  /** Canonical event-type values (multi-select). Empty = any. */
  eventTypes: string[];
  eventDatePreset: InboxEventDatePreset;
  /** Custom range only (YYYY-MM-DD). Ignored unless preset is custom. */
  eventDateFrom: string;
  eventDateTo: string;
  /** Specific event lookup — secondary to type/date. */
  eventId: string;
  eventStatus: string;
  hasAttachments: boolean;
  sort: InboxSort;
};

export type InboxActiveChip = {
  id: string;
  label: string;
};

export const INBOX_EVENT_DATE_PRESET_OPTIONS: { value: InboxEventDatePreset; label: string }[] = [
  { value: "any", label: "Any date" },
  { value: "past", label: "Past" },
  { value: "today", label: "Today" },
  { value: "next_7", label: "Next 7 days" },
  { value: "next_30", label: "Next 30 days" },
  { value: "this_month", label: "This month" },
  { value: "next_month", label: "Next month" },
  { value: "this_year", label: "This year" },
  { value: "custom", label: "Custom range" },
];

export const INBOX_SORT_OPTIONS: { value: InboxSort; label: string }[] = [
  { value: "recent", label: "Most recent activity" },
  { value: "oldest", label: "Oldest activity" },
  { value: "event_date_asc", label: "Event date — soonest first" },
  { value: "event_date_desc", label: "Event date — latest first" },
  { value: "client_name_asc", label: "Client name A–Z" },
  { value: "client_name_desc", label: "Client name Z–A" },
];

/** Canonical types for the Event type filter (existing vocabulary only). */
export const INBOX_EVENT_TYPE_OPTIONS = EVENT_TYPES;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local calendar YYYY-MM-DD from a Date. */
export function toInboxDateString(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + days);
  return x;
}

/**
 * Resolve Event date preset → inclusive from/to (YYYY-MM-DD), or nulls for Any.
 * `today` is injectable for tests (local calendar day).
 */
export function resolveInboxEventDateRange(
  preset: InboxEventDatePreset,
  customFrom: string,
  customTo: string,
  today: Date = new Date(),
): { from: string | null; to: string | null } {
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  switch (preset) {
    case "any":
      return { from: null, to: null };
    case "past":
      return { from: null, to: toInboxDateString(addDays(startOfToday, -1)) };
    case "today": {
      const t = toInboxDateString(startOfToday);
      return { from: t, to: t };
    }
    case "next_7":
      return {
        from: toInboxDateString(startOfToday),
        to: toInboxDateString(addDays(startOfToday, 6)),
      };
    case "next_30":
      return {
        from: toInboxDateString(startOfToday),
        to: toInboxDateString(addDays(startOfToday, 29)),
      };
    case "this_month": {
      const first = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1);
      const last = new Date(startOfToday.getFullYear(), startOfToday.getMonth() + 1, 0);
      return { from: toInboxDateString(first), to: toInboxDateString(last) };
    }
    case "next_month": {
      const first = new Date(startOfToday.getFullYear(), startOfToday.getMonth() + 1, 1);
      const last = new Date(startOfToday.getFullYear(), startOfToday.getMonth() + 2, 0);
      return { from: toInboxDateString(first), to: toInboxDateString(last) };
    }
    case "this_year": {
      const first = new Date(startOfToday.getFullYear(), 0, 1);
      const last = new Date(startOfToday.getFullYear(), 11, 31);
      return { from: toInboxDateString(first), to: toInboxDateString(last) };
    }
    case "custom":
      return {
        from: customFrom.trim() || null,
        to: customTo.trim() || null,
      };
    default:
      return { from: null, to: null };
  }
}

export function defaultInboxFilters(): InboxFilterState {
  return {
    attention: "all",
    relationship: "all",
    bookingStage: INBOX_FILTER_ALL,
    channel: INBOX_FILTER_ALL,
    assignment: { mode: "any" },
    eventTypes: [],
    eventDatePreset: "any",
    eventDateFrom: "",
    eventDateTo: "",
    eventId: INBOX_FILTER_ALL,
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
    && state.eventTypes.length === 0
    && state.eventDatePreset === d.eventDatePreset
    && state.eventDateFrom === d.eventDateFrom
    && state.eventDateTo === d.eventDateTo
    && state.eventId === d.eventId
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

const SORT_CHIP_LABELS: Partial<Record<InboxSort, string>> = {
  oldest: "Oldest activity",
  event_date_asc: "Soonest event first",
  event_date_desc: "Latest event first",
  client_name_asc: "Name A–Z",
  client_name_desc: "Name Z–A",
};

function eventTypesChipLabel(types: string[]): string {
  if (types.length === 1) return eventTypeLabel(types[0]!) || types[0]!;
  if (types.length === 2) {
    return `${eventTypeLabel(types[0]!) || types[0]}, ${eventTypeLabel(types[1]!) || types[1]}`;
  }
  return `${types.length} event types`;
}

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
  if (state.eventTypes.length > 0) {
    chips.push({ id: "eventTypes", label: eventTypesChipLabel(state.eventTypes) });
  }
  if (state.eventDatePreset !== "any") {
    if (state.eventDatePreset === "custom") {
      const from = state.eventDateFrom || "…";
      const to = state.eventDateTo || "…";
      chips.push({ id: "eventDates", label: `Event dates ${from} → ${to}` });
    } else {
      const presetLabel = INBOX_EVENT_DATE_PRESET_OPTIONS.find((o) => o.value === state.eventDatePreset)?.label
        ?? state.eventDatePreset;
      chips.push({ id: "eventDates", label: presetLabel });
    }
  }
  if (state.eventId !== INBOX_FILTER_ALL) {
    chips.push({
      id: "eventId",
      label: opts?.eventLabel ? `Specific event: ${opts.eventLabel}` : "Specific event",
    });
  }
  if (state.eventStatus !== INBOX_FILTER_ALL) {
    chips.push({ id: "eventStatus", label: STATUS_LABELS[state.eventStatus] ?? state.eventStatus });
  }
  if (state.hasAttachments) chips.push({ id: "hasAttachments", label: "Has attachments" });
  const sortChip = SORT_CHIP_LABELS[state.sort];
  if (sortChip) chips.push({ id: "sort", label: sortChip });
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
    case "eventTypes":
      return { ...state, eventTypes: [] };
    case "eventId":
      return { ...state, eventId: INBOX_FILTER_ALL };
    case "eventDates":
      return { ...state, eventDatePreset: "any", eventDateFrom: "", eventDateTo: "" };
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

export function toggleInboxEventType(state: InboxFilterState, typeValue: string): InboxFilterState {
  const has = state.eventTypes.includes(typeValue);
  return {
    ...state,
    eventTypes: has
      ? state.eventTypes.filter((t) => t !== typeValue)
      : [...state.eventTypes, typeValue],
  };
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
  eventTypes: string[] | null;
  eventDateFrom: string | null;
  eventDateTo: string | null;
  eventStatus: string | null;
  hasAttachments: boolean;
  sort: InboxSort;
};

export function inboxFiltersToQuery(
  state: InboxFilterState,
  currentStaffId: string | null,
  today: Date = new Date(),
): InboxPageQueryFields {
  let assignedStaffId: string | null = null;
  let unassignedOnly = false;
  if (state.assignment.mode === "unassigned") unassignedOnly = true;
  else if (state.assignment.mode === "me") assignedStaffId = currentStaffId;
  else if (state.assignment.mode === "staff") assignedStaffId = state.assignment.staffId;

  const range = resolveInboxEventDateRange(
    state.eventDatePreset,
    state.eventDateFrom,
    state.eventDateTo,
    today,
  );

  return {
    unreadOnly: state.attention === "unread",
    needsResponseOnly: state.attention === "needs_response",
    relationship: state.relationship,
    channel: state.channel === INBOX_FILTER_ALL ? null : state.channel,
    bookingStage: state.bookingStage === INBOX_FILTER_ALL ? null : state.bookingStage,
    assignedStaffId,
    unassignedOnly,
    eventId: state.eventId === INBOX_FILTER_ALL ? null : state.eventId,
    eventTypes: state.eventTypes.length > 0 ? state.eventTypes : null,
    eventDateFrom: range.from,
    eventDateTo: range.to,
    eventStatus: state.eventStatus === INBOX_FILTER_ALL ? null : state.eventStatus,
    hasAttachments: state.hasAttachments,
    sort: state.sort,
  };
}
