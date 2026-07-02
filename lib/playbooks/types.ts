export type TaskOwner = "coordinator" | "couple" | "vendor" | "team";
export type TaskVisibility = "coordinator_only" | "client_visible" | "client_owned" | "vendor_visible" | "vendor_owned";
export type TaskCategory = "communication" | "financial" | "planning" | "document" | "meeting" | "internal" | "custom";
export type TaskStatus = "pending" | "blocked" | "complete" | "overdue" | "waived";
export type TaskPhase = "planning" | "final_details" | "wedding_day" | "post_wedding";

export type PlaybookTemplate = {
  id: string;
  venueId: string;
  name: string;
  eventType: string | null;
  isDefault: boolean;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PlaybookTask = {
  id: string;
  templateId: string;
  venueId: string;
  title: string;
  description: string | null;
  ownerType: TaskOwner;
  visibility: TaskVisibility;
  daysOffset: number;   // negative = before event, positive = after event
  category: TaskCategory;
  phase: TaskPhase | null;  // lifecycle stage; null = unset (treated as "planning")
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
  category: TaskCategory;
  phase: TaskPhase | null;  // lifecycle stage; null = unset
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

export type PlaybookTaskInput = {
  title: string;
  description: string;
  ownerType: TaskOwner;
  visibility: TaskVisibility;
  daysOffset: string;          // string in form, parsed to int
  category: TaskCategory;
  phase: TaskPhase | null;
  autoCompleteTrigger: string;
  dependsOnTaskId: string;
  isRequired: boolean;
};

export type PlaybookActionResult =
  | { ok: true }
  | { ok: false; message?: string };

export type CreatePlaybookResult =
  | { ok: true; templateId: string }
  | { ok: false; message?: string };
