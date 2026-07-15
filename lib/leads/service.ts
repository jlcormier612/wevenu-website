/**
 * Leads application service.
 * Orchestrates auth, venue lookup, validation, and persistence.
 * Components and server actions call here — never the repository directly.
 * Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import * as repo from "@/lib/leads/repository";
import type {
  CreateLeadResult,
  Lead,
  LeadActionResult,
  LeadInput,
  LeadStatus,
  LeadWithDetails,
  RelationshipInput,
  TaskInput,
} from "@/lib/leads/types";
import {
  validateLeadInput,
  validateStatus,
  validateTaskInput,
} from "@/lib/leads/validation";
import { getCurrentVenue } from "@/lib/venue/service";
import { triggerSequencesForRelationship } from "@/lib/message-sequences/service";
import { CANONICAL_STAGE_TO_LEAD_STATUS } from "@/lib/leads/pipeline-stage-mapping";
import type { CanonicalStage } from "@/lib/pipeline-templates/types";

/** Shared auth + venue guard. Returns a typed error if anything is missing. */
async function withVenue<T>(
  fn: (
    supabase: Awaited<ReturnType<typeof createClient>>,
    venueId: string,
  ) => Promise<T>,
): Promise<T | LeadActionResult> {
  if (!isSupabaseConfigured)
    return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue)
    return { ok: false, message: "No venue found. Complete setup first." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user)
    return { ok: false, message: "Session expired. Please sign in again." };
  return fn(supabase, venue.id);
}

// ---- read -------------------------------------------------------------------

export async function getLeads(filters?: { q?: string; status?: string }): Promise<Lead[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  return repo.getLeads(supabase, venue.id, filters);
}

/** An already-active Lead matching this email (or, absent an email, this exact name) — for import-time duplicate detection. Null if the venue can't be resolved, matching this module's other read functions' fail-open shape. */
export async function findActiveDuplicateLead(email: string, firstName: string, lastName: string): Promise<{ id: string } | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  return repo.findActiveDuplicate(supabase, venue.id, email, firstName, lastName);
}

export async function getLead(leadId: string): Promise<LeadWithDetails | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  return repo.getLead(supabase, venue.id, leadId);
}

// ---- create -----------------------------------------------------------------

export async function createLead(input: LeadInput): Promise<CreateLeadResult> {
  const errors = validateLeadInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const result = await withVenue(async (supabase, venueId) => {
    const leadId = await repo.insertLead(supabase, venueId, input);
    // Activity is logged by the DB trigger (log_lead_created).

    // Rule-based Series enrollment (§3.2) — must never block lead creation.
    const { data: lead } = await supabase.from("leads").select("relationship_id")
      .eq("id", leadId).maybeSingle<{ relationship_id: string | null }>();
    if (lead?.relationship_id) {
      void triggerSequencesForRelationship(supabase, venueId, lead.relationship_id, "lead_created")
        .catch((e) => console.error("Series enrollment (lead_created) failed:", e));
    }

    return { ok: true, leadId } as CreateLeadResult;
  });
  if ("ok" in result && result.ok === false) return result as CreateLeadResult;
  return result as CreateLeadResult;
}

// ---- update status ----------------------------------------------------------

export async function updateLeadStatus(
  leadId: string,
  status: string,
): Promise<LeadActionResult> {
  if (!validateStatus(status))
    return { ok: false, message: `"${status}" is not a valid status.` };
  const result = await withVenue(async (supabase, venueId) => {
    await repo.updateLeadStatus(supabase, venueId, leadId, status as LeadStatus);
    // Activity is logged by the DB trigger (log_lead_status_changed).

    // Fire tour_converted signal when a lead with a tour moves to won
    if (status === "won") {
      const { data: tour } = await supabase
        .from("tour_appointments")
        .select("id")
        .eq("lead_id", leadId)
        .eq("venue_id", venueId)
        .limit(1)
        .maybeSingle<{ id: string }>();
      if (tour) {
        void supabase.from("lead_signal_events").insert({
          venue_id: venueId, lead_id: leadId,
          signal_type: "tour_converted", signal_strength: 3,
          metadata: { appointment_id: tour.id },
        }).then(null, () => {});
      }
    }

    // Rule-based Series enrollment (§3.2) — must never block a status change.
    const { data: lead } = await supabase.from("leads").select("relationship_id")
      .eq("id", leadId).maybeSingle<{ relationship_id: string | null }>();
    if (lead?.relationship_id) {
      void triggerSequencesForRelationship(supabase, venueId, lead.relationship_id, "lead_stage_changed", status)
        .catch((e) => console.error("Series enrollment (lead_stage_changed) failed:", e));
    }

    return { ok: true } as LeadActionResult;
  });
  return result as LeadActionResult;
}

// ---- Pipeline Stage (Phase 2 compatibility layer) ----------------------------
// leads.status stays the enforced field everywhere else (analytics,
// Automated Series, scoring, the status-change activity trigger — none of
// that is touched here). pipeline_stage_id is purely additive: explicit
// when a coordinator sets it, otherwise derived from status for display.

/** Raw pipeline_stage_id for one lead — null if never explicitly set. Does not touch getLead/getLeads. */
export async function getLeadPipelineStageId(leadId: string): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("leads").select("pipeline_stage_id")
    .eq("id", leadId).eq("venue_id", venue.id).maybeSingle<{ pipeline_stage_id: string | null }>();
  return data?.pipeline_stage_id ?? null;
}

/** pipeline_stage_id for every lead in the venue, keyed by lead id — for the list page's per-row display. */
export async function getPipelineStageIdsForVenue(): Promise<Record<string, string | null>> {
  if (!isSupabaseConfigured) return {};
  const venue = await getCurrentVenue();
  if (!venue) return {};
  const supabase = await createClient();
  const { data } = await supabase.from("leads").select("id, pipeline_stage_id").eq("venue_id", venue.id);
  const map: Record<string, string | null> = {};
  for (const row of (data ?? []) as { id: string; pipeline_stage_id: string | null }[]) map[row.id] = row.pipeline_stage_id;
  return map;
}

/**
 * A coordinator picked a Pipeline Stage. Maps its canonical stage to a real
 * leads.status value and writes that through the existing, completely
 * unchanged updateLeadStatus() — every side effect it already has (activity
 * trigger, tour_converted signal, Automated Series enrollment) fires
 * exactly as it does today. pipeline_stage_id is then set as a second,
 * separate write, purely for "which exact stage" display fidelity.
 */
export async function updateLeadPipelineStage(leadId: string, stageId: string): Promise<LeadActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const { data: stage } = await supabase.from("pipeline_stages").select("canonical_stage")
      .eq("id", stageId).eq("venue_id", venueId).maybeSingle<{ canonical_stage: CanonicalStage }>();
    if (!stage) return { ok: false, message: "That pipeline stage no longer exists." } as LeadActionResult;

    const mappedStatus = CANONICAL_STAGE_TO_LEAD_STATUS[stage.canonical_stage];
    const statusResult = await updateLeadStatus(leadId, mappedStatus);
    if (!statusResult.ok) return statusResult;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("leads") as any)
      .update({ pipeline_stage_id: stageId }).eq("id", leadId).eq("venue_id", venueId);
    if (error) return { ok: false, message: "Status updated, but could not save the exact stage." } as LeadActionResult;

    return { ok: true } as LeadActionResult;
  });
  return result as LeadActionResult;
}

// ---- notes ------------------------------------------------------------------

export async function addNote(
  leadId: string,
  body: string,
): Promise<LeadActionResult> {
  if (!body.trim()) return { ok: false, message: "Note cannot be empty." };
  const result = await withVenue(async (supabase, venueId) => {
    await repo.insertNote(supabase, venueId, leadId, body);
    await repo.insertActivity(supabase, venueId, leadId, "note_added", "Note added");
    return { ok: true } as LeadActionResult;
  });
  return result as LeadActionResult;
}

export async function updateNote(
  noteId: string,
  leadId: string,
  body: string,
): Promise<LeadActionResult> {
  if (!body.trim()) return { ok: false, message: "Note cannot be empty." };
  const result = await withVenue(async (supabase, venueId) => {
    await repo.updateNote(supabase, venueId, noteId, body);
    await repo.insertActivity(supabase, venueId, leadId, "note_updated", "Note edited");
    return { ok: true } as LeadActionResult;
  });
  return result as LeadActionResult;
}

export async function deleteNote(noteId: string): Promise<LeadActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.deleteNote(supabase, venueId, noteId);
    return { ok: true } as LeadActionResult;
  });
  return result as LeadActionResult;
}

// ---- tasks ------------------------------------------------------------------

export async function addTask(
  leadId: string,
  input: TaskInput,
): Promise<LeadActionResult> {
  const errors = validateTaskInput(input);
  if (Object.keys(errors).length > 0)
    return { ok: false, errors, message: errors.title };
  const result = await withVenue(async (supabase, venueId) => {
    await repo.insertTask(supabase, venueId, leadId, input);
    await repo.insertActivity(supabase, venueId, leadId, "task_created", `Task added: ${input.title.trim()}`);
    return { ok: true } as LeadActionResult;
  });
  return result as LeadActionResult;
}

export async function updateTask(
  taskId: string,
  input: { title: string; dueDate: string },
): Promise<LeadActionResult> {
  if (!input.title.trim()) return { ok: false, message: "Task title is required." };
  const result = await withVenue(async (supabase, venueId) => {
    await repo.updateTask(supabase, venueId, taskId, input);
    return { ok: true } as LeadActionResult;
  });
  return result as LeadActionResult;
}

export async function setTaskCompleted(
  taskId: string,
  completed: boolean,
  leadId?: string,
  taskTitle?: string,
): Promise<LeadActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.setTaskCompleted(supabase, venueId, taskId, completed);
    if (completed && leadId && taskTitle) {
      await repo.insertActivity(supabase, venueId, leadId, "task_completed", `Task completed: ${taskTitle}`);
    }
    return { ok: true } as LeadActionResult;
  });
  return result as LeadActionResult;
}

export async function deleteTask(taskId: string): Promise<LeadActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.deleteTask(supabase, venueId, taskId);
    return { ok: true } as LeadActionResult;
  });
  return result as LeadActionResult;
}

// ---- Sprint 6: lead info + relationship -------------------------------------

export async function updateLeadInfo(
  leadId: string,
  input: LeadInput,
): Promise<LeadActionResult> {
  const errors = validateLeadInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const result = await withVenue(async (supabase, venueId) => {
    await repo.updateLeadInfo(supabase, venueId, leadId, input);
    await repo.insertActivity(supabase, venueId, leadId, "lead_updated", "Lead information updated");
    return { ok: true } as LeadActionResult;
  });
  return result as LeadActionResult;
}

export async function updateRelationshipFields(
  leadId: string,
  input: RelationshipInput,
  activityHints: { tourScheduled?: boolean; followUpSet?: boolean; contactedSet?: boolean },
): Promise<LeadActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.updateRelationshipFields(supabase, venueId, leadId, input);
    // Log specific meaningful events rather than a generic "updated".
    if (activityHints.tourScheduled && input.tourDate) {
      const { formatDate } = await import("@/lib/leads/constants");
      await repo.insertActivity(supabase, venueId, leadId, "tour_scheduled",
        `Tour scheduled for ${formatDate(input.tourDate)}`);
    } else if (activityHints.followUpSet && input.followUpDate) {
      const { formatDate } = await import("@/lib/leads/constants");
      await repo.insertActivity(supabase, venueId, leadId, "follow_up_set",
        `Follow-up set for ${formatDate(input.followUpDate)}`);
    } else if (activityHints.contactedSet && input.lastContactedAt) {
      await repo.insertActivity(supabase, venueId, leadId, "last_contacted",
        "Marked as last contacted");
    } else {
      await repo.insertActivity(supabase, venueId, leadId, "relationship_updated",
        "Relationship details updated");
    }
    return { ok: true } as LeadActionResult;
  });
  return result as LeadActionResult;
}
