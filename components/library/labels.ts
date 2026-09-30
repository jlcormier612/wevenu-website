/**
 * Shared customer-facing Library action language.
 * Domains stay different underneath — labels stay consistent where concepts match.
 */

export const LIBRARY_LABELS = {
  preview: "Preview",
  edit: "Edit",
  /** Collection-row primary action — same word across template types. */
  useTemplate: "Use",
  usePackage: "Use Package",
  useForm: "Use Form",
  useQuestionnaire: "Use Questionnaire",
  createQuestionnaire: "Create Questionnaire",
  sendQuestionnaire: "Send Questionnaire",
  stopClientAccess: "Stop client access",
  sendToClient: "Send to client",
  reviewAndSend: "Review & Send",
  useTimeline: "Use",
  useFloorPlan: "Use",
  useEventOrder: "Use",
  useInventoryTemplate: "Use",
  useOffering: "Use Offering",
  useMessage: "Use Message",
  useQrCampaign: "Use QR Campaign",
  openReport: "Open report",
  duplicate: "Duplicate",
  addAnotherCopy: "Add another copy",
  archive: "Archive",
  restore: "Restore",
  delete: "Delete",
  saveChanges: "Save changes",
  saving: "Saving…",
  saved: "Saved",
  savedJustNow: "Saved just now",
  /** Durable autosave completion — must not fade into a blank state. */
  allChangesSaved: "All changes saved",
  autosaveTeaching: "Changes save as you work. You can leave anytime.",
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

/**
 * Hello to Cheers starter insertion labels — distinct from Duplicate.
 * Repeated insertion is allowed (fresh venue-owned copy; prior customizations stay).
 */
export function starterInsertLabel(name: string, alreadyPresent: boolean): string {
  return alreadyPresent ? `Add another copy of ${name}` : `Add ${name}`;
}
