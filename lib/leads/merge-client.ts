/**
 * Client-safe Merge Lead types and Continue-gate helpers.
 *
 * Must never import server modules (Supabase server client, venue/service,
 * product-sync, fs). The dialog imports only from this file so the browser
 * bundle cannot pull Node-only provisioning/storage through merge.ts.
 */

export type MergeFieldKey =
  | "first_name"
  | "last_name"
  | "email"
  | "phone"
  | "partner_first_name"
  | "partner_last_name"
  | "partner_email"
  | "event_type"
  | "event_date"
  | "end_date"
  | "guest_count"
  | "estimated_budget"
  | "inquiry_message"
  | "next_action_text"
  | "next_action_due"
  | "follow_up_date"
  | "planned_event_space_id"
  | "assigned_staff_id"
  | "source"
  | "preferred_communication_channels";

/**
 * `*Value` fields are the merge-persisted identifiers/text.
 * `*Display` fields are venue-facing labels (names for FK fields; same as value otherwise).
 * Never show raw UUIDs from `*Value` in the merge preview UI — use `*Display`.
 */
export type FieldDiff =
  | {
      key: MergeFieldKey;
      kind: "fill";
      primaryValue: string | null;
      secondaryValue: string;
      secondaryDisplay: string;
      label: string;
    }
  | {
      key: MergeFieldKey;
      kind: "same";
      value: string;
      valueDisplay: string;
      label: string;
    }
  | {
      key: MergeFieldKey;
      kind: "conflict";
      primaryValue: string;
      secondaryValue: string;
      primaryDisplay: string;
      secondaryDisplay: string;
      label: string;
    }
  | {
      key: MergeFieldKey;
      kind: "keep_primary";
      primaryValue: string | null;
      primaryDisplay: string | null;
      label: string;
    };

/** Customer-facing label for a diff value — never falls back to exposing a UUID FK. */
export function fieldDiffShown(
  d: FieldDiff,
  which: "primary" | "secondary" | "value",
): string {
  if (d.kind === "fill" && which === "secondary") return d.secondaryDisplay;
  if (d.kind === "same" && which === "value") return d.valueDisplay;
  if (d.kind === "conflict" && which === "primary") return d.primaryDisplay;
  if (d.kind === "conflict" && which === "secondary") return d.secondaryDisplay;
  if (d.kind === "keep_primary" && which === "primary") return d.primaryDisplay ?? "empty";
  return "";
}

export type TourSummary = {
  id: string;
  leadId: string;
  status: string;
  scheduledAt: string | null;
  isArchived: boolean;
};

export type MergeBlocker = {
  code: "tour_protection" | "same_lead" | "cross_venue" | "already_merged" | "primary_is_merged" | "not_found";
  message: string;
};

export type MergeLeadCard = {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
  salesStage: string | null;
  source: string | null;
  mergedIntoLeadId: string | null;
};

export type MergePreview = {
  ok: true;
  venueId: string;
  primary: MergeLeadCard;
  secondary: MergeLeadCard;
  primaryIsDefaultEarliest: boolean;
  needsExplicitPrimaryChoice: boolean;
  fieldDiffs: FieldDiff[];
  notesOnSecondary: number;
  tasksOnSecondary: number;
  activitiesOnSecondary: number;
  tours: TourSummary[];
  occupyingTourConflict: boolean;
  blockers: MergeBlocker[];
  relatedSummary: string[];
};

/** Concise row for Merge Lead search — discovery only; never auto-merges. */
export type MergeSearchCandidate = {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  partnerDisplayName: string | null;
  partnerEmail: string | null;
  eventDate: string | null;
  createdAt: string;
  salesStage: string | null;
};

/** True when any conflict field still lacks an explicit venue choice. */
export function hasUnresolvedMergeFieldConflicts(
  fieldDiffs: FieldDiff[],
  fieldChoices: Record<string, string | undefined>,
): boolean {
  return fieldDiffs.some((d) => {
    if (d.kind !== "conflict") return false;
    const chosen = fieldChoices[d.key];
    return chosen === undefined || chosen === "";
  });
}

/** Footer Continue / final-confirm gate — matches confirmMergeLeads conflict rules. */
export function canAdvanceToMergeFinalConfirm(input: {
  preview: Pick<MergePreview, "blockers" | "needsExplicitPrimaryChoice" | "fieldDiffs"> | null;
  explicitPrimaryId: string | null | undefined;
  fieldChoices: Record<string, string | undefined>;
}): boolean {
  const { preview, explicitPrimaryId, fieldChoices } = input;
  if (!preview || preview.blockers.length > 0) return false;
  if (preview.needsExplicitPrimaryChoice && !explicitPrimaryId) return false;
  if (hasUnresolvedMergeFieldConflicts(preview.fieldDiffs, fieldChoices)) return false;
  return true;
}
