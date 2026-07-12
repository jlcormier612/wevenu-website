import type { PlaybookKind, TaskActionType, TaskCategory, TaskOwner, TaskStatus, TaskVisibility } from "@/lib/playbooks/types";

// A task becomes navigation into the platform, not a static checklist item
// (Vendor Management — Next Iteration, 2026-07-10). Each destination is a
// tab already on the event page — the URL hash makes that tab addressable
// (see event-detail.tsx) rather than just landing on the event.
//
// guest_list has no dedicated venue-side view yet — the real Guest List
// feature (RSVPs, dietary needs, etc.) only exists in the couple portal
// today. This points at Overview (where guest count lives) as the closest
// honest destination until a real venue-side guest view exists — see
// docs/product-backlog.md.
export const TASK_ACTION_TYPES: { value: TaskActionType; defaultLabel: string; tabHash: string }[] = [
  { value: "vendor_library", defaultLabel: "Open Vendor Library",  tabHash: "vendors" },
  { value: "payments",       defaultLabel: "Open Payments",        tabHash: "invoice" },
  { value: "documents",      defaultLabel: "Open Documents",       tabHash: "documents" },
  { value: "guest_list",     defaultLabel: "Open Guest List",      tabHash: "overview" },
];

export function taskActionLabel(actionType: TaskActionType | null, customLabel: string | null): string | null {
  if (!actionType) return null;
  return customLabel || TASK_ACTION_TYPES.find((a) => a.value === actionType)?.defaultLabel || "Open";
}

export function taskActionHref(actionType: TaskActionType | null, eventId: string): string | null {
  if (!actionType) return null;
  const tab = TASK_ACTION_TYPES.find((a) => a.value === actionType)?.tabHash ?? "overview";
  return `/events/${eventId}#${tab}`;
}

export const PLAYBOOK_KINDS: { value: PlaybookKind; label: string; description: string; emoji: string }[] = [
  { value: "client", label: "Client Planning", description: "The checklist your client works through themselves — visible in their portal.", emoji: "💍" },
  { value: "venue",  label: "Venue Planning",   description: "The checklist your own team works through — who's doing what, and by when.", emoji: "🏛" },
];

export function playbookKindLabel(kind: PlaybookKind): string {
  return PLAYBOOK_KINDS.find((k) => k.value === kind)?.label ?? kind;
}

export const TASK_CATEGORIES: { value: TaskCategory; label: string; color: string }[] = [
  { value: "communication", label: "Communication", color: "#5D6F5D" },
  { value: "financial",     label: "Financial",     color: "#C7A66A" },
  { value: "planning",      label: "Planning",      color: "#4F5F4F" },
  { value: "document",      label: "Document",      color: "#B8AEA1" },
  { value: "meeting",       label: "Meeting",       color: "#B9D1C2" },
  { value: "internal",      label: "Internal",      color: "#DED6CA" },
  { value: "custom",        label: "Custom",        color: "#D8A7AA" },
];

export const TASK_OWNERS: { value: TaskOwner; label: string }[] = [
  { value: "coordinator", label: "Coordinator" },
  { value: "couple",      label: "Client" },
  { value: "vendor",      label: "Vendor" },
  { value: "team",        label: "Team" },
];

export const TASK_VISIBILITY: { value: TaskVisibility; label: string; hint: string }[] = [
  { value: "coordinator_only", label: "Coordinator only",   hint: "Only visible to your team" },
  { value: "client_visible",   label: "Visible to client",  hint: "Client can see but not edit" },
  { value: "client_owned",     label: "Client completes",   hint: "Client must complete this task" },
  { value: "vendor_visible",   label: "Visible to vendor",  hint: "Relevant vendor can see" },
  { value: "vendor_owned",     label: "Vendor completes",   hint: "Vendor must complete this task" },
];

export const AUTO_COMPLETE_TRIGGERS: { value: string; label: string }[] = [
  { value: "",                      label: "Manual (coordinator marks complete)" },
  { value: "contract_signed",       label: "Contract signed" },
  { value: "payment_received",      label: "Any payment received" },
  { value: "questionnaire_submitted", label: "Final details submitted" },
  { value: "document_uploaded",     label: "Any document uploaded" },
  { value: "document_uploaded_insurance", label: "Insurance COI uploaded" },
  { value: "timeline_created",      label: "Timeline entries added" },
  { value: "floor_plan_created",    label: "Floor plan created" },
  { value: "vendor_selected",       label: "Client chooses a recommended vendor" },
];

// "waiting" replaces the old lock icon (2026-07-09) — a task waiting on
// another task is still just a task, not something restricted. The default
// visual should read "this is a task," never "this is locked."
export const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; icon: "check" | "clock" | "waiting" | "alert" | "minus" }> = {
  complete: { label: "Complete",  color: "var(--success)",              icon: "check" },
  pending:  { label: "Pending",   color: "var(--muted-foreground)",     icon: "clock" },
  blocked:  { label: "Waiting",   color: "#C7A66A",                    icon: "waiting" },
  overdue:  { label: "Overdue",   color: "var(--destructive)",          icon: "alert" },
  waived:   { label: "Waived",    color: "var(--muted-foreground)",     icon: "minus" },
};

export function categoryLabel(cat: TaskCategory): string {
  return TASK_CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
}

export function categoryColor(cat: TaskCategory): string {
  return TASK_CATEGORIES.find((c) => c.value === cat)?.color ?? "#B8AEA1";
}

// Scheduled Activity (Calendar Integration — Phase 1) — presentation helpers
// only; the underlying rule is always EventTask.scheduledDate/scheduledStartTime/
// scheduledEndTime/location, set directly, never derived. A due date answers
// "when should this be finished"; a scheduled activity answers "when does
// this actually happen" — most tasks have only the former.
export function isScheduledActivity(task: { scheduledDate: string | null }): boolean {
  return task.scheduledDate !== null;
}

// Postgres `time` comes back as "HH:MM:SS" — presentation-only conversion
// to "2:00 PM", same spirit as formatDaysOffset below.
export function formatScheduledTime(time: string | null): string | null {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

// Presentation only — the underlying rule is always daysOffset (Product
// Decisions, 2026-07-08: "keep the existing days_offset implementation; the
// natural-language phrasing is presentation only"). A venue never sees or
// types a raw offset — this is the one place that number becomes a sentence.
export function formatDaysOffset(offset: number): string {
  if (offset === 0) return "On the event day";
  if (offset < 0) return `${Math.abs(offset)} day${Math.abs(offset) === 1 ? "" : "s"} before the event`;
  return `${offset} day${offset === 1 ? "" : "s"} after the event`;
}

// The inverse of the composer below — "30" + "before" → -30, "0" + "on" → 0.
export type DueDateDirection = "before" | "on" | "after";

export function directionForOffset(offset: number): DueDateDirection {
  if (offset === 0) return "on";
  return offset < 0 ? "before" : "after";
}

export function offsetForDirection(days: number, direction: DueDateDirection): number {
  if (direction === "on") return 0;
  return direction === "before" ? -Math.abs(days) : Math.abs(days);
}

// The underlying model is always "Client Planning" — the label a couple (or
// other primary contact) actually sees is event-specific (Product Decisions,
// 2026-07-08: "Client Planning becomes the reusable platform concept... the
// presentation becomes event-specific"). Wevenu doesn't yet capture a company
// or organization name on a Client (see docs/product-backlog.md), so
// non-couple event types fall back to the event's own name rather than
// fabricating an organization field that doesn't exist.
const COUPLE_EVENT_TYPES = new Set(["wedding", "elopement", "engagement_party", "anniversary"]);

export function formatClientPlanningTitle(eventName: string, clientName: string | null, eventType: string | null): string {
  if (eventType && COUPLE_EVENT_TYPES.has(eventType) && clientName) {
    return `${clientName}'s Planning`;
  }
  return `${eventName} Planning`;
}

// Smart reminder defaults by category (Progressive Disclosure — a venue never
// has to think about this unless they want something different from the
// sensible default). Returned as-is; the Builder lets a venue override per task.
export function defaultReminderForCategory(category: TaskCategory): number[] | null {
  switch (category) {
    case "financial":      return [3];
    case "document":       return [7, 3];
    case "communication":  return [2];
    case "meeting":        return [1];
    default:               return null;
  }
}

// Notification rule defaults for seed tasks (all default to null/false; venues configure per-task)
// actionType/actionLabel default to null — seed tasks are plain checklist items until a venue opts one in.
const R = { reminderBeforeDays: null, escalationAfterDays: null, notifyOnAssign: false, notifyOnComplete: false, dueDateRuleKind: "relative_to_event", actionType: null, actionLabel: null } as const;

type SeedMilestone = { name: string; kind: import("@/lib/playbooks/types").MilestoneKind | null };
type SeedTask = Omit<import("@/lib/playbooks/types").PlaybookTask, "id" | "templateId" | "venueId" | "createdAt" | "milestoneId"> & { milestoneIndex: number };

// ── Standard Wedding (Client Planning) — reference implementation ──
// Every task is couple-owned by construction; the Client Planning editor
// never asks who does this, because the answer is never in doubt.

export const STANDARD_CLIENT_PLANNING_MILESTONES: SeedMilestone[] = [
  { name: "Booking",       kind: null },
  { name: "Planning",      kind: null },
  { name: "Final Details", kind: "final_stretch" },
  { name: "After Your Day", kind: null },
];

export const STANDARD_CLIENT_PLANNING_TASKS: SeedTask[] = [
  { ...R, title: "Sign your contract",       description: null, ownerType: "couple", visibility: "client_owned", daysOffset: -118, category: "document",      milestoneIndex: 0, autoCompleteTrigger: "contract_signed", isRequired: true,  sortOrder: 0, dependsOnTaskId: null },
  { ...R, title: "Choose your package",      description: null, ownerType: "couple", visibility: "client_owned", daysOffset: -115, category: "planning",      milestoneIndex: 0, autoCompleteTrigger: null,              isRequired: true,  sortOrder: 1, dependsOnTaskId: null },
  { ...R, title: "Complete your questionnaire", description: "Tell us about your vision for the day.", ownerType: "couple", visibility: "client_owned", daysOffset: -90, category: "planning", milestoneIndex: 1, autoCompleteTrigger: "questionnaire_submitted", isRequired: true, sortOrder: 2, dependsOnTaskId: null },
  { ...R, title: "Purchase event insurance", description: null, ownerType: "couple", visibility: "client_owned", daysOffset: -60, category: "document", milestoneIndex: 1, autoCompleteTrigger: "document_uploaded_insurance", isRequired: true, sortOrder: 3, dependsOnTaskId: null },
  { ...R, title: "Submit your guest count",  description: "We need your final headcount to plan seating, catering, and rentals.", ownerType: "couple", visibility: "client_owned", daysOffset: -30, category: "planning", milestoneIndex: 2, autoCompleteTrigger: null, isRequired: true, sortOrder: 4, dependsOnTaskId: null },
  { ...R, title: "Final payment",            description: null, ownerType: "couple", visibility: "client_owned", daysOffset: -30, category: "financial", milestoneIndex: 2, autoCompleteTrigger: "payment_received", isRequired: true, sortOrder: 5, dependsOnTaskId: null },
  { ...R, title: "Leave a review",           description: "We'd love to hear about your experience.", ownerType: "couple", visibility: "client_owned", daysOffset: 14, category: "communication", milestoneIndex: 3, autoCompleteTrigger: null, isRequired: false, sortOrder: 6, dependsOnTaskId: null },
];

// ── Standard Wedding (Venue Planning) — reference implementation ──
// Coordinator/team/vendor-owned tasks — who's doing it, what it depends on,
// and who to notify if it's overdue are all first-class here, unlike the
// Client Planning editor, which never exposes any of that.

export const STANDARD_VENUE_WORKFLOW_MILESTONES: SeedMilestone[] = [
  { name: "Booking",       kind: null },
  { name: "Final Details", kind: "final_stretch" },
  { name: "Wedding Day",   kind: "event_day" },
  { name: "Post-Event",    kind: null },
];

export const STANDARD_VENUE_WORKFLOW_TASKS: SeedTask[] = [
  { ...R, title: "Send contract",           description: null, ownerType: "coordinator", visibility: "coordinator_only", daysOffset: -120, category: "document",  milestoneIndex: 0, autoCompleteTrigger: null,             isRequired: true, sortOrder: 0, dependsOnTaskId: null },
  { ...R, title: "Verify deposit",          description: null, ownerType: "coordinator", visibility: "coordinator_only", daysOffset: -115, category: "financial", milestoneIndex: 0, autoCompleteTrigger: "payment_received", isRequired: true, sortOrder: 1, dependsOnTaskId: null },
  { ...R, title: "Build timeline",          description: "Build the complete day-of timeline.", ownerType: "coordinator", visibility: "coordinator_only", daysOffset: -21, category: "planning", milestoneIndex: 1, autoCompleteTrigger: "timeline_created", isRequired: true, sortOrder: 2, dependsOnTaskId: null },
  { ...R, title: "Create floor plan",       description: null, ownerType: "coordinator", visibility: "coordinator_only", daysOffset: -14, category: "planning", milestoneIndex: 1, autoCompleteTrigger: "floor_plan_created", isRequired: true, sortOrder: 3, dependsOnTaskId: null },
  { ...R, title: "Confirm rentals",         description: "Confirm final counts and delivery windows with rental vendors.", ownerType: "vendor", visibility: "vendor_owned", daysOffset: -14, category: "communication", milestoneIndex: 1, autoCompleteTrigger: null, isRequired: true, sortOrder: 4, dependsOnTaskId: null },
  { ...R, title: "Vendor COIs in file",     description: "Ensure all required insurance certificates are uploaded.", ownerType: "coordinator", visibility: "coordinator_only", daysOffset: -7, category: "document", milestoneIndex: 1, autoCompleteTrigger: "document_uploaded_insurance", isRequired: true, sortOrder: 5, dependsOnTaskId: null, escalationAfterDays: 2 },
  { ...R, title: "Prepare venue",           description: null, ownerType: "team", visibility: "coordinator_only", daysOffset: 0, category: "meeting", milestoneIndex: 2, autoCompleteTrigger: null, isRequired: true, sortOrder: 6, dependsOnTaskId: null },
  { ...R, title: "Day-of setup",            description: null, ownerType: "team", visibility: "coordinator_only", daysOffset: 0, category: "meeting", milestoneIndex: 2, autoCompleteTrigger: null, isRequired: true, sortOrder: 7, dependsOnTaskId: null },
  { ...R, title: "Send thank-you note",     description: "Send a warm thank-you to the client.", ownerType: "coordinator", visibility: "coordinator_only", daysOffset: 3, category: "communication", milestoneIndex: 3, autoCompleteTrigger: null, isRequired: false, sortOrder: 8, dependsOnTaskId: null },
];
