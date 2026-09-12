/**
 * Shared customer-facing Library action language.
 * Domains stay different underneath — labels stay consistent where concepts match.
 */

export const LIBRARY_LABELS = {
  preview: "Preview",
  edit: "Edit",
  useTemplate: "Use Template",
  usePackage: "Use Package",
  useForm: "Use Form",
  useQuestionnaire: "Use Questionnaire",
  createQuestionnaire: "Create Questionnaire",
  sendQuestionnaire: "Send Questionnaire",
  stopClientAccess: "Stop client access",
  sendToClient: "Send to client",
  reviewAndSend: "Review & Send",
  useTimeline: "Use Timeline",
  useFloorPlan: "Use Floor Plan",
  useEventOrder: "Use Event Order",
  useInventoryTemplate: "Use Inventory Template",
  useOffering: "Use Offering",
  useMessage: "Use Message",
  useQrCampaign: "Use QR Campaign",
  openReport: "Open report",
  duplicate: "Duplicate",
  archive: "Archive",
  restore: "Restore",
  delete: "Delete",
  saveChanges: "Save changes",
  saving: "Saving…",
  saved: "Saved",
  savedJustNow: "Saved just now",
  unableToSave: "Unable to save changes. Please try again.",
  cancel: "Cancel",
  optionsAria: "More actions",
  starter: "Starter",
  archived: "Archived",
  archivedSection: "Archived",
  yourTemplate: "Your template",
  paymentPlanBuilder: "Payment Plan Builder",
  paymentSchedule: "Payment Schedule",
} as const;

export function archiveToggleLabel(isArchived: boolean): string {
  return isArchived ? LIBRARY_LABELS.restore : LIBRARY_LABELS.archive;
}
