export type TaskOwner = "coordinator" | "couple" | "vendor" | "team";
export type TaskVisibility = "coordinator_only" | "client_visible" | "client_owned" | "vendor_visible" | "vendor_owned";
export type TaskCategory = "communication" | "financial" | "planning" | "document" | "meeting" | "internal" | "custom";
export type TaskStatus = "pending" | "blocked" | "complete" | "overdue" | "waived";

// A milestone's `kind` is the small, fixed, system-meaningful fact a venue's
// own custom-named chapter can optionally carry (Engineering Standard #11 —
// canonical kind vs. custom label). null = pure organization, no special
// behavior. Everything else about a milestone (name, order, how many exist)
// is fully venue-editable.
export type MilestoneKind = "event_day" | "final_stretch";

// The two independent planning experiences: Client Planning and Venue
// Planning (Product Decisions, 2026-07-08; renamed from "Venue Workflow" to
// "Venue Planning" per Planning Templates UX Rebuild, 2026-07-09). Internal
// value stays "venue" — only the user-facing label changed. Vendor-owned
// tasks are part of Venue Planning — there is no third kind.
export type PlaybookKind = "client" | "venue";

// V1 only implements relative_to_event (the existing daysOffset math,
// unchanged). Extensible on purpose: future kinds (relative_to_task,
// relative_to_trigger) extend this union and add their own reference field(s)
// when they're actually built, without redesigning daysOffset itself.
export type DueDateRuleKind = "relative_to_event";

export type PlaybookTemplate = {
  id: string;
  venueId: string;
  name: string;
  kind: PlaybookKind;
  eventType: string | null;
  isDefault: boolean;
  isArchived: boolean;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

// The Planning Template Library card grid needs counts that the base
// PlaybookTemplate row doesn't carry — computed alongside the template list,
// never stored.
export type PlaybookTemplateWithStats = PlaybookTemplate & {
  taskCount: number;
  usageCount: number;
};

export type PlaybookMilestone = {
  id: string;
  templateId: string;
  venueId: string;
  name: string;
  kind: MilestoneKind | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

// A task becomes navigation into the platform, not a static checklist item
// — "Choose a florist" opens the Vendor Library, "Pay final payment" opens
// Payments (Vendor Management — Next Iteration, 2026-07-10). Stored in
// columns (`action_type`/`action_label`) reserved back in the original
// "Task Action Centers" schema pass (20260628200000) and never activated
// until now — reusing them rather than adding parallel new ones.
export type TaskActionType = "vendor_library" | "payments" | "documents" | "guest_list";

export type PlaybookTask = {
  id: string;
  templateId: string;
  venueId: string;
  title: string;
  description: string | null;
  ownerType: TaskOwner;
  visibility: TaskVisibility;
  daysOffset: number;   // negative = before event, positive = after event
  dueDateRuleKind: DueDateRuleKind;
  category: TaskCategory;
  milestoneId: string;   // which chapter this task belongs to
  autoCompleteTrigger: string | null;
  dependsOnTaskId: string | null;
  isRequired: boolean;
  sortOrder: number;
  createdAt: string;
  // Notification rules (Sprint 43)
  reminderBeforeDays: number[] | null;   // [7, 3, 1] = remind 7, 3, 1 days before due
  escalationAfterDays: number | null;    // escalate to coordinator N days after overdue
  notifyOnAssign: boolean;
  notifyOnComplete: boolean;
  actionType: TaskActionType | null;
  actionLabel: string | null;   // null = a sensible default label for actionType
};

// What a task needs to get done — an uploaded file, an existing venue
// document, or a web link. Copied into the event's Related Context
// (EventTaskContextLink) at apply-time — same underlying idea, Definition
// side (Planning Templates UX Rebuild, 2026-07-09). Replaces the old single
// resourceUrl/resourceLabel field outright, not alongside it.
export type PlaybookTaskAttachment = {
  id: string;
  playbookTaskId: string;
  documentId: string | null;
  linkUrl: string | null;
  linkLabel: string | null;
  sortOrder: number;
  createdAt: string;
  // Resolved at read-time when documentId is set — never stored here.
  label: string;
};

export type EventTask = {
  id: string;
  venueId: string;
  eventId: string;
  templateTaskId: string | null;
  title: string;
  description: string | null;
  ownerType: TaskOwner;
  visibility: TaskVisibility;
  dueDate: string;         // ISO date "YYYY-MM-DD"
  daysOffset: number;
  dueDateRuleKind: DueDateRuleKind;
  // True once a coordinator has manually edited this task's due date on this
  // event — event-date-change recalculation skips locked tasks rather than
  // silently overwriting a deliberate override (Product Decisions, §3).
  dueDateLocked: boolean;
  category: TaskCategory;
  milestoneName: string;           // snapshot, copied at apply-time — not a live reference
  milestoneKind: MilestoneKind | null;
  autoCompleteTrigger: string | null;
  isRequired: boolean;
  status: TaskStatus;
  dependsOnEventTaskId: string | null;
  dependsOnTitle: string | null;
  completedAt: string | null;
  completedBy: string | null;
  notes: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  // Notification rules (Sprint 43)
  reminderBeforeDays: number[] | null;
  escalationAfterDays: number | null;
  notifyOnAssign: boolean;
  notifyOnComplete: boolean;
  assignedToStaffId: string | null;
  assignedToName: string | null;
  actionType: TaskActionType | null;
  actionLabel: string | null;
  // Optional link into the Request Framework (lib/requests) — set only when
  // a coordinator has chosen to turn this task into a client-facing Request.
  // Independent lifecycle: completing the Request never completes this task.
  requestId: string | null;
  // Scheduled Activity (Calendar Integration — Phase 1): a due date answers
  // "when should this be finished"; these answer "when does this actually
  // happen." All four are independently nullable — most tasks stay due-date
  // only. Only set when a coordinator would actually travel somewhere, meet
  // someone, or need to be present at a specific time (a Final Walkthrough,
  // Client/Vendor Meeting, Rehearsal, Venue Visit — or any custom task
  // marked this way). scheduledStartTime/scheduledEndTime are "HH:MM:SS".
  scheduledDate: string | null;
  scheduledStartTime: string | null;
  scheduledEndTime: string | null;
  location: string | null;
};

// A task's Related Context: a pointer into Conversation, Documents, the
// Day-of Timeline, or a raw web link — never a copy of that content (One
// Fact, One Owner, Planning Experience Review, 2026-07-08). Exactly one
// source is populated per link, matching the one-of-four DB constraint. A
// template's attachments (PlaybookTaskAttachment) are copied into these at
// apply-time — one mechanism serves both Definition and Execution.
export type EventTaskContextSourceType = "conversation_message" | "document" | "timeline_entry" | "link";

export type EventTaskContextLink = {
  id: string;
  eventTaskId: string;
  sourceType: EventTaskContextSourceType;
  sourceId: string;
  createdAt: string;
  // Resolved at read-time from the owning system — never stored here, so a
  // renamed document or edited message is reflected automatically.
  label: string;
  detail: string | null;
};

// The contact line shown on a Client Planning task — defaulted from the
// assigned coordinator, falling back to the venue's own profile, never a
// field re-typed per task (Planning Experience Review, 2026-07-08).
export type TaskContact = {
  name: string;
  email: string | null;
};

export type TaskReminderType = "upcoming" | "due_today" | "overdue" | "escalation";
export type TaskReminderStatus = "pending" | "sent" | "cancelled" | "skipped";
export type TaskReminderRole = "coordinator" | "couple" | "vendor" | "team";

export type TaskReminder = {
  id: string;
  venueId: string;
  eventTaskId: string;
  reminderType: TaskReminderType;
  notifyRole: TaskReminderRole;
  scheduledFor: string;    // ISO timestamp
  status: TaskReminderStatus;
  sentAt: string | null;
  createdAt: string;
};

export type EventReadiness = {
  score: number;               // 0–100: completed required / total required × 100
  completedRequired: number;
  totalRequired: number;
  completedOptional: number;
  totalOptional: number;
  tasks: EventTask[];
  blockedCount: number;
  overdueCount: number;
};

// One row per (event, kind) once a playbook has been applied — the guard
// that prevents a second application of the same kind, and the source of
// truth for "which playbook is applied here" shown in the event UI
// (Product Decisions, 2026-07-08).
//
// releasedAt (Draft → Release workflow, 2026-07-10): null means Draft —
// applied and editable by the coordinator, not yet visible to the client.
// Venue Planning has no draft state and gets releasedAt set to appliedAt the
// moment it's applied, so "is this active" is one releasedAt-is-not-null
// check regardless of kind — only Client Planning ever actually shows Draft.
export type EventPlaybookApplication = {
  eventId: string;
  kind: PlaybookKind;
  templateId: string | null;
  templateName: string;
  appliedAt: string;
  releasedAt: string | null;
};

export type PlaybookActionResult =
  | { ok: true }
  | { ok: false; message?: string };

export type CreatePlaybookResult =
  | { ok: true; templateId: string }
  | { ok: false; message?: string };

// "Bring Your Existing Checklist" (2026-07-10) — same shape as
// CreatePlaybookResult, plus enough for the one-time "N due dates were
// estimated, please double-check them" banner right after creation. Not
// tracked per-task after that — the coordinator reviews everything in the
// real Template Editor immediately, so a persistent per-task flag isn't
// needed on top of a one-time summary.
export type ImportPlaybookResult =
  | { ok: true; templateId: string; taskCount: number; guessedCount: number }
  | { ok: false; message: string };
