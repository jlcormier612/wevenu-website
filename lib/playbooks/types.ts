export type TaskOwner = "coordinator" | "couple" | "vendor" | "team";
export type TaskVisibility = "coordinator_only" | "client_visible" | "client_owned" | "vendor_visible" | "vendor_owned";
export type TaskCategory = "communication" | "financial" | "planning" | "document" | "meeting" | "internal" | "custom";
export type TaskStatus = "pending" | "blocked" | "complete" | "overdue" | "waived";

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
  autoCompleteTrigger: string | null;
  dependsOnTaskId: string | null;
  isRequired: boolean;
  sortOrder: number;
  createdAt: string;
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
  autoCompleteTrigger: string | null;
  isRequired: boolean;
  status: TaskStatus;
  dependsOnEventTaskId: string | null;
  // Embedded: dependency task details for "blocked" display
  dependsOnTitle: string | null;
  completedAt: string | null;
  completedBy: string | null;
  notes: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
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
