import type { TaskCategory, TaskOwner, TaskPhase, TaskStatus, TaskVisibility } from "@/lib/playbooks/types";

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
  { value: "couple",      label: "Couple" },
  { value: "vendor",      label: "Vendor" },
  { value: "team",        label: "Team" },
];

export const TASK_VISIBILITY: { value: TaskVisibility; label: string; hint: string }[] = [
  { value: "coordinator_only", label: "Coordinator only",   hint: "Only visible to your team" },
  { value: "client_visible",   label: "Visible to couple",  hint: "Couple can see but not edit" },
  { value: "client_owned",     label: "Couple completes",   hint: "Couple must complete this task" },
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
];

export const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; icon: "check" | "clock" | "lock" | "alert" | "minus" }> = {
  complete: { label: "Complete",  color: "var(--success)",              icon: "check" },
  pending:  { label: "Pending",   color: "var(--muted-foreground)",     icon: "clock" },
  blocked:  { label: "Blocked",   color: "#C7A66A",                    icon: "lock"  },
  overdue:  { label: "Overdue",   color: "var(--destructive)",          icon: "alert" },
  waived:   { label: "Waived",    color: "var(--muted-foreground)",     icon: "minus" },
};

export function categoryLabel(cat: TaskCategory): string {
  return TASK_CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
}

export function categoryColor(cat: TaskCategory): string {
  return TASK_CATEGORIES.find((c) => c.value === cat)?.color ?? "#B8AEA1";
}

export const TASK_PHASES: { value: TaskPhase; label: string; color: string; description: string }[] = [
  { value: "planning",      label: "Planning",       color: "#5D6F5D", description: "Long-range planning tasks (booking vendors, sending contracts)" },
  { value: "final_details", label: "Final Details",  color: "#C7A66A", description: "2–4 weeks out (vendor confirmations, floor plan, final walkthrough)" },
  { value: "wedding_day",   label: "Wedding Day",    color: "#D8A7AA", description: "Day-of operations and run of show" },
  { value: "post_wedding",  label: "Post-Wedding",   color: "#B9D1C2", description: "Follow-up tasks (thank-you, reviews, gallery delivery)" },
];

export function phaseLabel(phase: TaskPhase | null): string {
  if (!phase) return "Planning";
  return TASK_PHASES.find((p) => p.value === phase)?.label ?? phase;
}

export function phaseColor(phase: TaskPhase | null): string {
  if (!phase) return "#5D6F5D";
  return TASK_PHASES.find((p) => p.value === phase)?.color ?? "#B8AEA1";
}

export function inferPhaseFromOffset(offset: number): TaskPhase {
  if (offset > 0) return "post_wedding";
  if (offset === 0) return "wedding_day";
  if (offset >= -14) return "final_details";
  return "planning";
}

export function formatDaysOffset(offset: number): string {
  if (offset === 0) return "On event date";
  if (offset < 0) return `${Math.abs(offset)} days before`;
  return `${offset} days after`;
}

// Notification rule defaults for seed tasks (all default to null/false; venues configure per-task)
const R = { reminderBeforeDays: null, escalationAfterDays: null, notifyOnAssign: false, notifyOnComplete: false } as const;

/** Default Wedding playbook tasks for seeding a new venue's first template. */
export const DEFAULT_WEDDING_TASKS: Omit<import("@/lib/playbooks/types").PlaybookTask, "id" | "templateId" | "venueId" | "createdAt">[] = [
  // ── Planning phase ────────────────────────────────────────────────────────
  { ...R, title: "Contract sent",           description: null, ownerType: "coordinator", visibility: "coordinator_only", daysOffset: -120, category: "document",      phase: "planning",      autoCompleteTrigger: null,                      isRequired: true,  sortOrder: 0,  dependsOnTaskId: null },
  { ...R, title: "Deposit received",        description: null, ownerType: "coordinator", visibility: "coordinator_only", daysOffset: -90,  category: "financial",     phase: "planning",      autoCompleteTrigger: "payment_received",         isRequired: true,  sortOrder: 1,  dependsOnTaskId: null },
  { ...R, title: "Questionnaire sent",      description: "Send the final details form to the couple.", ownerType: "coordinator", visibility: "coordinator_only", daysOffset: -90, category: "communication", phase: "planning", autoCompleteTrigger: null, isRequired: true, sortOrder: 2, dependsOnTaskId: null },
  { ...R, title: "Final details submitted", description: "Couple completes the final details form.", ownerType: "couple", visibility: "client_owned", daysOffset: -60, category: "planning", phase: "planning", autoCompleteTrigger: "questionnaire_submitted", isRequired: true, sortOrder: 3, dependsOnTaskId: null, notifyOnComplete: true },
  { ...R, title: "Final payment due",       description: null, ownerType: "couple", visibility: "client_visible", daysOffset: -30, category: "financial", phase: "planning", autoCompleteTrigger: "payment_received", isRequired: true, sortOrder: 4, dependsOnTaskId: null },
  // ── Final Details phase ───────────────────────────────────────────────────
  { ...R, title: "Day-of timeline created", description: "Build the complete day-of timeline.", ownerType: "coordinator", visibility: "coordinator_only", daysOffset: -14, category: "planning", phase: "final_details", autoCompleteTrigger: "timeline_created", isRequired: true, sortOrder: 5, dependsOnTaskId: null },
  { ...R, title: "Floor plan created",      description: null, ownerType: "coordinator", visibility: "coordinator_only", daysOffset: -14, category: "planning", phase: "final_details", autoCompleteTrigger: "floor_plan_created", isRequired: true, sortOrder: 6, dependsOnTaskId: null },
  { ...R, title: "Vendor confirmations",    description: "Confirm arrival times with all vendors.", ownerType: "coordinator", visibility: "coordinator_only", daysOffset: -7, category: "communication", phase: "final_details", autoCompleteTrigger: null, isRequired: true, sortOrder: 7, dependsOnTaskId: null },
  { ...R, title: "Vendor COIs in file",     description: "Ensure all required insurance certificates are uploaded.", ownerType: "coordinator", visibility: "coordinator_only", daysOffset: -7, category: "document", phase: "final_details", autoCompleteTrigger: "document_uploaded_insurance", isRequired: true, sortOrder: 8, dependsOnTaskId: null },
  { ...R, title: "Final walkthrough",       description: null, ownerType: "coordinator", visibility: "coordinator_only", daysOffset: -3, category: "meeting", phase: "final_details", autoCompleteTrigger: null, isRequired: true, sortOrder: 9, dependsOnTaskId: null },
  // ── Post-Wedding phase ────────────────────────────────────────────────────
  { ...R, title: "Send thank-you note",     description: "Send a warm thank-you to the couple.", ownerType: "coordinator", visibility: "coordinator_only", daysOffset: 3,  category: "communication", phase: "post_wedding", autoCompleteTrigger: null, isRequired: false, sortOrder: 10, dependsOnTaskId: null },
  { ...R, title: "Request a review",        description: "Ask the couple to share their experience.", ownerType: "coordinator", visibility: "coordinator_only", daysOffset: 14, category: "communication", phase: "post_wedding", autoCompleteTrigger: null, isRequired: false, sortOrder: 11, dependsOnTaskId: null },
];
