/**
 * Venue-controlled Merge Lead — preview + confirm.
 * Primary defaults to earliest created_at. Never hard-deletes.
 * Atomic confirm via merge_leads_v1 RPC. No customer messages on merge.
 */
import { createClient } from "@/integrations/supabase/server";
import { getCurrentVenue } from "@/lib/venue/service";
import { leadDisplayName } from "@/lib/leads/constants";

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

export type FieldDiff =
  | { key: MergeFieldKey; kind: "fill"; primaryValue: string | null; secondaryValue: string; label: string }
  | { key: MergeFieldKey; kind: "same"; value: string; label: string }
  | { key: MergeFieldKey; kind: "conflict"; primaryValue: string; secondaryValue: string; label: string }
  | { key: MergeFieldKey; kind: "keep_primary"; primaryValue: string | null; label: string };

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

export type ConfirmMergeInput = {
  primaryId: string;
  secondaryId: string;
  primaryUpdatedAt: string;
  secondaryUpdatedAt: string;
  /** Final values for fields that need fill or conflict resolution */
  fieldChoices: Partial<Record<MergeFieldKey, string | string[] | null>>;
  /** Tour appointment ids to cancel (release slot) before reparent */
  tourCancelIds: string[];
};

type LeadSnap = {
  id: string;
  venue_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  partner_first_name: string | null;
  partner_last_name: string | null;
  partner_email: string | null;
  event_type: string | null;
  event_date: string | null;
  end_date: string | null;
  guest_count: number | null;
  estimated_budget: number | null;
  inquiry_message: string | null;
  next_action_text: string | null;
  next_action_due: string | null;
  follow_up_date: string | null;
  planned_event_space_id: string | null;
  assigned_staff_id: string | null;
  source: string | null;
  preferred_communication_channels: string[] | null;
  sales_stage: string | null;
  created_at: string;
  updated_at: string;
  merged_into_lead_id: string | null;
};

const FIELD_LABELS: Record<MergeFieldKey, string> = {
  first_name: "First name",
  last_name: "Last name",
  email: "Email",
  phone: "Phone",
  partner_first_name: "Partner first name",
  partner_last_name: "Partner last name",
  partner_email: "Partner email",
  event_type: "Event type",
  event_date: "Event date",
  end_date: "End date",
  guest_count: "Guest count",
  estimated_budget: "Estimated budget",
  inquiry_message: "Inquiry message",
  next_action_text: "Next action",
  next_action_due: "Next action due",
  follow_up_date: "Follow-up date",
  planned_event_space_id: "Planned event space",
  assigned_staff_id: "Assigned staff",
  source: "Source",
  preferred_communication_channels: "Preferred channels",
};

const SCALAR_KEYS: MergeFieldKey[] = [
  "first_name", "last_name", "email", "phone",
  "partner_first_name", "partner_last_name", "partner_email",
  "event_type", "event_date", "end_date", "guest_count", "estimated_budget",
  "inquiry_message", "next_action_text", "next_action_due", "follow_up_date",
  "planned_event_space_id", "assigned_staff_id", "source",
];

function norm(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) {
    const joined = v.map(String).sort().join(",");
    return joined || null;
  }
  const s = String(v).trim();
  return s.length ? s : null;
}

function card(row: LeadSnap): MergeLeadCard {
  return {
    id: row.id,
    displayName: leadDisplayName(row.first_name, row.last_name, row.partner_first_name, row.partner_last_name),
    email: row.email,
    phone: row.phone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    salesStage: row.sales_stage,
    source: row.source,
    mergedIntoLeadId: row.merged_into_lead_id,
  };
}

function buildFieldDiffs(primary: LeadSnap, secondary: LeadSnap): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  for (const key of SCALAR_KEYS) {
    const p = norm(primary[key as keyof LeadSnap]);
    const s = norm(secondary[key as keyof LeadSnap]);
    const label = FIELD_LABELS[key];
    if (!p && !s) continue;
    if (!p && s) {
      diffs.push({ key, kind: "fill", primaryValue: null, secondaryValue: s, label });
    } else if (p && s && p === s) {
      diffs.push({ key, kind: "same", value: p, label });
    } else if (p && s && p !== s) {
      diffs.push({ key, kind: "conflict", primaryValue: p, secondaryValue: s, label });
    } else {
      diffs.push({ key, kind: "keep_primary", primaryValue: p, label });
    }
  }
  const pCh = norm(primary.preferred_communication_channels);
  const sCh = norm(secondary.preferred_communication_channels);
  const chLabel = FIELD_LABELS.preferred_communication_channels;
  if (!pCh && sCh) {
    diffs.push({
      key: "preferred_communication_channels",
      kind: "fill",
      primaryValue: null,
      secondaryValue: sCh,
      label: chLabel,
    });
  } else if (pCh && sCh && pCh !== sCh) {
    diffs.push({
      key: "preferred_communication_channels",
      kind: "conflict",
      primaryValue: pCh,
      secondaryValue: sCh,
      label: chLabel,
    });
  }
  return diffs;
}

function pickDefaultPrimary(a: LeadSnap, b: LeadSnap): { primary: LeadSnap; secondary: LeadSnap; tied: boolean } {
  const cmp = a.created_at.localeCompare(b.created_at);
  if (cmp < 0) return { primary: a, secondary: b, tied: false };
  if (cmp > 0) return { primary: b, secondary: a, tied: false };
  // Identical created_at — require explicit choice
  const byId = a.id.localeCompare(b.id);
  if (byId <= 0) return { primary: a, secondary: b, tied: true };
  return { primary: b, secondary: a, tied: true };
}

async function loadLeadPair(
  supabase: Awaited<ReturnType<typeof createClient>>,
  venueId: string,
  leadAId: string,
  leadBId: string,
): Promise<{ a: LeadSnap | null; b: LeadSnap | null }> {
  const { data } = await supabase
    .from("leads")
    .select(
      "id,venue_id,first_name,last_name,email,phone,partner_first_name,partner_last_name,partner_email,event_type,event_date,end_date,guest_count,estimated_budget,inquiry_message,next_action_text,next_action_due,follow_up_date,planned_event_space_id,assigned_staff_id,source,preferred_communication_channels,sales_stage,created_at,updated_at,merged_into_lead_id",
    )
    .eq("venue_id", venueId)
    .in("id", [leadAId, leadBId]);
  const rows = (data ?? []) as LeadSnap[];
  return {
    a: rows.find((r) => r.id === leadAId) ?? null,
    b: rows.find((r) => r.id === leadBId) ?? null,
  };
}

export async function previewMergeLeads(
  leadAId: string,
  leadBId: string,
  options?: { primaryId?: string },
): Promise<MergePreview | { ok: false; message: string }> {
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expired. Please sign in again." };

  if (leadAId === leadBId) {
    return { ok: false, message: "Choose two different leads to merge." };
  }

  const { a, b } = await loadLeadPair(supabase, venue.id, leadAId, leadBId);
  if (!a || !b) {
    return { ok: false, message: "One or both leads were not found in this venue." };
  }

  const blockers: MergeBlocker[] = [];
  let primary: LeadSnap;
  let secondary: LeadSnap;
  let tied = false;
  let primaryIsDefaultEarliest = true;

  if (options?.primaryId) {
    if (options.primaryId === a.id) {
      primary = a;
      secondary = b;
      primaryIsDefaultEarliest = a.created_at <= b.created_at;
    } else if (options.primaryId === b.id) {
      primary = b;
      secondary = a;
      primaryIsDefaultEarliest = b.created_at <= a.created_at;
    } else {
      return { ok: false, message: "Primary lead must be one of the two selected leads." };
    }
    tied = a.created_at === b.created_at;
  } else {
    const picked = pickDefaultPrimary(a, b);
    primary = picked.primary;
    secondary = picked.secondary;
    tied = picked.tied;
  }

  if (secondary.merged_into_lead_id) {
    blockers.push({
      code: "already_merged",
      message: `The secondary lead was already merged into ${secondary.merged_into_lead_id}.`,
    });
  }
  if (primary.merged_into_lead_id) {
    blockers.push({
      code: "primary_is_merged",
      message: "The selected primary lead was itself merged into another lead. Open the surviving lead instead.",
    });
  }

  const { count: protectionCount } = await supabase
    .from("tour_protection_requests")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", venue.id)
    .in("lead_id", [primary.id, secondary.id]);
  if ((protectionCount ?? 0) > 0) {
    blockers.push({
      code: "tour_protection",
      message: "A tour protection request is linked to one of these leads. Resolve it before merging.",
    });
  }

  const [{ count: notesOnSecondary }, { count: tasksOnSecondary }, { count: activitiesOnSecondary }, toursRes] =
    await Promise.all([
      supabase.from("lead_notes").select("id", { count: "exact", head: true }).eq("venue_id", venue.id).eq("lead_id", secondary.id),
      supabase.from("lead_tasks").select("id", { count: "exact", head: true }).eq("venue_id", venue.id).eq("lead_id", secondary.id),
      supabase.from("lead_activities").select("id", { count: "exact", head: true }).eq("venue_id", venue.id).eq("lead_id", secondary.id),
      supabase
        .from("tour_appointments")
        .select("id, lead_id, status, scheduled_at, is_archived")
        .eq("venue_id", venue.id)
        .in("lead_id", [primary.id, secondary.id])
        .order("scheduled_at", { ascending: true }),
    ]);

  const tours: TourSummary[] = ((toursRes.data ?? []) as Array<{
    id: string; lead_id: string; status: string; scheduled_at: string | null; is_archived: boolean;
  }>).map((t) => ({
    id: t.id,
    leadId: t.lead_id,
    status: t.status,
    scheduledAt: t.scheduled_at,
    isArchived: t.is_archived,
  }));

  const occupying = tours.filter((t) => t.status === "scheduled" || t.status === "confirmed");
  const occupyingOnBoth =
    occupying.some((t) => t.leadId === primary.id) && occupying.some((t) => t.leadId === secondary.id);

  const fieldDiffs = buildFieldDiffs(primary, secondary);
  const relatedSummary = [
    `${notesOnSecondary ?? 0} note(s) on secondary will move to the primary lead`,
    `${tasksOnSecondary ?? 0} task(s) on secondary will move to the primary lead`,
    `${activitiesOnSecondary ?? 0} activity record(s) will move to the primary lead`,
    `${tours.length} tour appointment(s) across both leads — appointments are reassociated, not recreated`,
    "Communication history stays attributed; merge does not send messages or enroll sequences",
    "Secondary lead is soft-marked as merged (not deleted) and redirects to the primary",
  ];

  return {
    ok: true,
    venueId: venue.id,
    primary: card(primary),
    secondary: card(secondary),
    primaryIsDefaultEarliest,
    needsExplicitPrimaryChoice: tied && !options?.primaryId,
    fieldDiffs,
    notesOnSecondary: notesOnSecondary ?? 0,
    tasksOnSecondary: tasksOnSecondary ?? 0,
    activitiesOnSecondary: activitiesOnSecondary ?? 0,
    tours,
    occupyingTourConflict: occupyingOnBoth,
    blockers,
    relatedSummary,
  };
}

export async function confirmMergeLeads(
  input: ConfirmMergeInput,
): Promise<{ ok: true; primaryId: string; secondaryId: string; alreadyMerged?: boolean } | { ok: false; message: string }> {
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expired. Please sign in again." };

  // Revalidate preview assumptions against live rows before RPC
  const preview = await previewMergeLeads(input.primaryId, input.secondaryId, {
    primaryId: input.primaryId,
  });
  if (!preview.ok) return preview;
  if (preview.blockers.length > 0) {
    return { ok: false, message: preview.blockers.map((b) => b.message).join(" ") };
  }
  if (preview.needsExplicitPrimaryChoice) {
    return { ok: false, message: "Created times match — choose which lead survives before confirming." };
  }
  if (preview.primary.id !== input.primaryId || preview.secondary.id !== input.secondaryId) {
    return { ok: false, message: "Primary/secondary selection no longer matches. Refresh and try again." };
  }
  if (
    preview.primary.updatedAt !== input.primaryUpdatedAt
    || preview.secondary.updatedAt !== input.secondaryUpdatedAt
  ) {
    return { ok: false, message: "One of these leads changed since preview. Refresh and review again." };
  }

  // Conflicts require an explicit choice in fieldChoices
  for (const diff of preview.fieldDiffs) {
    if (diff.kind === "conflict" && !(diff.key in input.fieldChoices)) {
      return { ok: false, message: `Choose a value for conflicting field: ${diff.label}.` };
    }
  }

  // Two occupying tours: venue must cancel at least the extras they don't want,
  // OR explicitly keep both (tourCancelIds empty is allowed — both reparent).
  // Never auto-cancel. If they pass cancel ids, verify they belong to the pair.
  const tourIds = new Set(preview.tours.map((t) => t.id));
  for (const id of input.tourCancelIds) {
    if (!tourIds.has(id)) {
      return { ok: false, message: "A tour selected for cancellation is not part of this merge." };
    }
  }

  const fieldPatch: Record<string, unknown> = {};
  for (const diff of preview.fieldDiffs) {
    if (diff.kind === "fill") {
      const chosen = input.fieldChoices[diff.key];
      fieldPatch[diff.key] = chosen !== undefined ? chosen : diff.secondaryValue;
    } else if (diff.kind === "conflict") {
      const chosen = input.fieldChoices[diff.key];
      if (chosen === undefined || chosen === null || chosen === "") {
        return { ok: false, message: `Choose a value for conflicting field: ${diff.label}.` };
      }
      fieldPatch[diff.key] = chosen;
    }
  }

  // preferred_communication_channels: if fill used comma string, expand to array
  if (typeof fieldPatch.preferred_communication_channels === "string") {
    fieldPatch.preferred_communication_channels = String(fieldPatch.preferred_communication_channels)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const audit = {
    fieldChoices: input.fieldChoices,
    tourCancelIds: input.tourCancelIds,
    fills: preview.fieldDiffs.filter((d) => d.kind === "fill").map((d) => d.key),
    conflicts: preview.fieldDiffs.filter((d) => d.kind === "conflict").map((d) => d.key),
    actor: user.id,
    at: new Date().toISOString(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("merge_leads_v1", {
    p_venue_id: venue.id,
    p_primary_id: input.primaryId,
    p_secondary_id: input.secondaryId,
    p_primary_updated_at: input.primaryUpdatedAt,
    p_secondary_updated_at: input.secondaryUpdatedAt,
    p_field_patch: fieldPatch,
    p_tour_cancel_ids: input.tourCancelIds,
    p_audit: audit,
  });

  if (error) {
    return { ok: false, message: error.message || "Merge failed." };
  }
  const result = data as {
    ok?: boolean;
    error?: string;
    alreadyMerged?: boolean;
    primaryId?: string;
    secondaryId?: string;
    mergedInto?: string;
  } | null;

  if (!result?.ok) {
    const code = result?.error ?? "unknown";
    if (code === "stale") {
      return { ok: false, message: "One of these leads changed since preview. Refresh and review again." };
    }
    if (code === "unauthorized") {
      return { ok: false, message: "You do not have permission to merge leads for this venue." };
    }
    if (code === "tour_protection") {
      return { ok: false, message: "A tour protection request blocks this merge." };
    }
    if (code === "secondary_already_merged") {
      return { ok: false, message: `Secondary lead was already merged into ${result?.mergedInto ?? "another lead"}.` };
    }
    return { ok: false, message: `Merge blocked (${code}).` };
  }

  return {
    ok: true,
    primaryId: result.primaryId ?? input.primaryId,
    secondaryId: result.secondaryId ?? input.secondaryId,
    alreadyMerged: result.alreadyMerged === true,
  };
}

/** Pure helpers exported for unit tests */
export const mergeTestHelpers = {
  buildFieldDiffs,
  pickDefaultPrimary,
  norm,
  FIELD_LABELS,
};
