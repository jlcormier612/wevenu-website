/**
 * Leads application service.
 * Orchestrates auth, venue lookup, validation, and persistence.
 * Components and server actions call here — never the repository directly.
 * Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import * as repo from "@/lib/leads/repository";
import { LeadTourWriteError, TOUR_TIME_REQUIRED } from "@/lib/leads/relationship-tour";
import { tourCapacityFailureFromUnknown } from "@/lib/tours/occupancy";
import { requireAdminUser } from "@/lib/hq/crm-service";
import type {
  CreateLeadResult,
  Lead,
  LeadActionResult,
  LeadInput,
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
import { exitActiveEnrollmentsForRelationship } from "@/lib/message-sequences/repository";
import {
  triggerSequencesForRelationship,
  wouldEnrollOnStageChange,
} from "@/lib/message-sequences/service";
import {
  isForwardSalesStageMove,
  isManuallyAssignableSalesStage,
  isSalesStage,
  SALES_PIPELINE_RETURN_STAGE,
  type SalesStage,
} from "@/lib/leads/sales-stages";
import { ingestLead } from "@/lib/lead-intake/pipeline";
import type { RawIntakeInput, TrustTier } from "@/lib/lead-intake/types";
import { previewFirstStepForSequence } from "@/lib/message-sequences/confirm-preview";
import type { AutomationMessagePreview } from "@/lib/message-sequences/confirm-preview";

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

/**
 * Migration Center §2.1 item 3 (2026-07-22) — the same email-then-name
 * matching findActiveDuplicate() uses against the database, as an in-memory
 * key an import loop can check two CSV rows against each other with,
 * before either ever reaches the database. Case-insensitive, trimmed, to
 * match the DB check's `ilike` semantics exactly.
 */
export function leadIdentityKey(email: string | null | undefined, firstName: string, lastName: string): string {
  const trimmedEmail = (email ?? "").trim().toLowerCase();
  return trimmedEmail || `${firstName.trim().toLowerCase()}|${lastName.trim().toLowerCase()}`;
}

/** Import-loop → Lead Intake pipeline shape. Only the fields logDuplicateBatchRejection's normalizer actually reads matter here — same field set createLeadCore already threads into ingestLead's own `input`. */
export function leadInputToRawIntake(input: LeadInput): RawIntakeInput {
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    partnerFirstName: input.partnerFirstName,
    partnerLastName: input.partnerLastName,
    partnerEmail: input.partnerEmail,
    eventType: input.eventType,
    eventDate: input.eventDate,
    endDate: input.endDate,
    guestCount: input.guestCount ? parseInt(input.guestCount, 10) || null : null,
    estimatedBudget: input.estimatedBudget ? parseFloat(input.estimatedBudget) || null : null,
    inquiryMessage: input.inquiryMessage,
    inquiryDate: input.inquiryDate,
  };
}

/** An already-active Lead matching this email (or, absent an email, this exact name) — for import-time duplicate detection. Null if the venue can't be resolved, matching this module's other read functions' fail-open shape. */
export async function findActiveDuplicateLead(email: string, firstName: string, lastName: string): Promise<{ id: string } | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  return repo.findActiveDuplicate(supabase, venue.id, email, firstName, lastName);
}

/** White-Glove Migration (Hospitality Success Platform §2.2a step 4) — see createClientForVenue's doc comment (lib/clients/service.ts) for the pattern this mirrors. */
export async function findActiveDuplicateLeadForVenue(venueId: string, email: string, firstName: string, lastName: string): Promise<{ id: string } | null> {
  if (!isSupabaseConfigured) return null;
  const actor = await requireAdminUser();
  if (!actor) return null;
  return repo.findActiveDuplicate(createAdminClient(), venueId, email, firstName, lastName);
}

export async function getLead(leadId: string): Promise<LeadWithDetails | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  return repo.getLead(supabase, venue.id, leadId);
}

// ---- create -----------------------------------------------------------------

/**
 * The real create-a-lead logic, independent of how `venueId` was resolved.
 * Extracted so White-Glove imports (`createLeadForVenue`, Hospitality
 * Success Platform §2.2a) run through the exact same Lead Intake pipeline
 * self-service does. See createClientCore's doc comment for the pattern.
 */
async function createLeadCore(
  supabase: Awaited<ReturnType<typeof createClient>>, venueId: string, input: LeadInput, trustTier: TrustTier,
  historicalImport = false,
): Promise<CreateLeadResult> {
  // Routed through the Lead Intake pipeline (Log Attempt → Relationship
  // Resolution → Lead Creation → Automation Trigger → Assignment Hook) —
  // manual entry and CSV import are just another Source Adapter now, not
  // a separate implementation. Activity is logged by the DB trigger
  // (log_lead_created), same as every other source.
  const outcome = await ingestLead({
    supabase,
    venueId,
    source: input.source || "other",
    trustTier,
    historicalImport,
    rawPayload: input,
    input: {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      partnerFirstName: input.partnerFirstName,
      partnerLastName: input.partnerLastName,
      partnerEmail: input.partnerEmail,
      eventType: input.eventType,
      eventDate: input.eventDate,
      endDate: input.endDate,
      guestCount: input.guestCount ? parseInt(input.guestCount, 10) || null : null,
      estimatedBudget: input.estimatedBudget ? parseFloat(input.estimatedBudget) || null : null,
      inquiryMessage: input.inquiryMessage,
      inquiryDate: input.inquiryDate,
      sourceData: input.originalSourceLabel ? { original_source_label: input.originalSourceLabel } : undefined,
    },
    create: async () => {
      try {
        const leadId = await repo.insertLead(supabase, venueId, input, historicalImport);
        const { data: lead } = await supabase.from("leads").select("relationship_id")
          .eq("id", leadId).maybeSingle<{ relationship_id: string | null }>();
        if (!lead?.relationship_id) return { ok: false, error: "Lead created without a relationship." };
        const { count } = await supabase.from("leads")
          .select("id", { count: "exact", head: true })
          .eq("relationship_id", lead.relationship_id);
        return { ok: true, leadId, relationshipId: lead.relationship_id, isReturningRelationship: (count ?? 0) > 1 };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Could not create lead." };
      }
    },
  });

  if (!outcome.ok) return { ok: false, message: outcome.error };
  return { ok: true, leadId: outcome.leadId };
}

/**
 * `trustTier` defaults to "manual" (the single-lead-add form's own use)
 * but the CSV import actions pass "import" explicitly — Migration Center
 * §2.1 item 3 (2026-07-22): TrustTier already had a real "import" value
 * defined, but every import-created lead was silently mislabeled "manual"
 * since this always hardcoded that value regardless of caller.
 */
export async function createLead(
  input: LeadInput, trustTier: TrustTier = "manual", historicalImport = false,
): Promise<CreateLeadResult> {
  const errors = validateLeadInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const result = await withVenue((supabase, venueId) => createLeadCore(supabase, venueId, input, trustTier, historicalImport));
  return result as CreateLeadResult;
}

/**
 * White-Glove Migration (Hospitality Success Platform §2.2a step 4) — see
 * createClientForVenue's doc comment for the pattern this mirrors. Always
 * an import, so trustTier is fixed at "import", not a parameter.
 * `historicalImport` (Migration Center) defaults true here — an admin
 * importing on a venue's behalf is migrating backfilled data far more often
 * than not; a genuinely current lead a specialist enters live should pass
 * `false` explicitly.
 */
export async function createLeadForVenue(venueId: string, input: LeadInput, historicalImport = true): Promise<CreateLeadResult> {
  const actor = await requireAdminUser();
  if (!actor) return { ok: false, message: "Not signed in as an HQ admin." };
  const errors = validateLeadInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const admin = createAdminClient();
  return createLeadCore(admin, venueId, input, "import", historicalImport);
}

// ---- update sales stage -----------------------------------------------------

export async function updateLeadSalesStage(
  leadId: string,
  stage: string,
  opts?: {
    allowBooked?: boolean;
    clientId?: string | null;
    /** Required to leave Booked for a non-Lost sales-pipeline stage (Move back to Sales Pipeline). */
    allowLeaveBooked?: boolean;
  },
): Promise<LeadActionResult> {
  if (!validateStatus(stage) || !isSalesStage(stage))
    return { ok: false, message: `"${stage}" is not a valid sales stage.` };
  if (stage === "booked" && !opts?.allowBooked) {
    return { ok: false, message: "Booked is only set by converting the lead with Book This Lead." };
  }
  if (!opts?.allowBooked && !isManuallyAssignableSalesStage(stage)) {
    return { ok: false, message: "That stage cannot be set manually." };
  }

  const result = await withVenue(async (supabase, venueId) => {
    const { data: before } = await supabase.from("leads").select("sales_stage")
      .eq("id", leadId).eq("venue_id", venueId)
      .maybeSingle<{ sales_stage: string | null }>();
    const previousStage = before?.sales_stage ?? null;

    // Leaving Booked for an active sales stage requires the deliberate Move Back path.
    // Lost remains available from Booked (deal died after booking).
    if (
      previousStage === "booked"
      && stage !== "booked"
      && stage !== "lost"
      && !opts?.allowLeaveBooked
    ) {
      return {
        ok: false,
        message: "Use Move back to Sales Pipeline to leave Booked.",
      } as LeadActionResult;
    }

    await repo.updateLeadSalesStage(supabase, venueId, leadId, stage);

    if (stage === "booked") {
      // Idempotent: already Booked → do not emit another lifecycle event.
      // Booked → Lost → Booked emits rebooked via recordLifecycleBooking.
      if (previousStage !== "booked") {
        const { data: { user } } = await supabase.auth.getUser();
        let clientId = opts?.clientId ?? null;
        if (!clientId) {
          const { data: linked } = await supabase.from("clients").select("id")
            .eq("lead_id", leadId).eq("venue_id", venueId)
            .maybeSingle<{ id: string }>();
          clientId = linked?.id ?? null;
        }
        const { recordLifecycleBooking } = await import("@/lib/lifecycle-bookings/service");
        const recorded = await recordLifecycleBooking(supabase, {
          venueId,
          leadId,
          clientId,
          origin: "pipeline",
          actorUserId: user?.id ?? null,
          previousSalesStage: previousStage,
        });
        if (!recorded.ok) {
          console.error("Lifecycle booking record failed:", recorded.message);
        }
      }

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

    const { data: lead } = await supabase.from("leads").select("relationship_id")
      .eq("id", leadId).maybeSingle<{ relationship_id: string | null }>();
    if (lead?.relationship_id) {
      if (stage === "lost") {
        try {
          await exitActiveEnrollmentsForRelationship(
            supabase, venueId, lead.relationship_id, "exited_lost",
          );
        } catch (e) {
          console.error("Series exit (exited_lost) failed:", e);
        }
      }
      if (stage === "booked") {
        try {
          await exitActiveEnrollmentsForRelationship(
            supabase, venueId, lead.relationship_id, "exited_booking",
          );
        } catch (e) {
          console.error("Series exit (exited_booking) failed:", e);
        }
      }
      void triggerSequencesForRelationship(supabase, venueId, lead.relationship_id, "lead_stage_changed", stage)
        .catch((e) => console.error("Series enrollment (lead_stage_changed) failed:", e));
    }

    return { ok: true } as LeadActionResult;
  });
  return result as LeadActionResult;
}

/** @deprecated Prefer updateLeadSalesStage */
export async function updateLeadStatus(
  leadId: string,
  status: string,
): Promise<LeadActionResult> {
  return updateLeadSalesStage(leadId, status);
}

/**
 * Forward-only auto stage advance (tour booked, sequence enroll, etc.).
 * Never moves backward; never overrides Booked/Lost.
 */
export async function advanceLeadSalesStageIfForward(
  leadId: string,
  target: SalesStage,
): Promise<LeadActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const { data: row } = await supabase.from("leads").select("sales_stage")
      .eq("id", leadId).eq("venue_id", venueId)
      .maybeSingle<{ sales_stage: string | null }>();
    if (!row?.sales_stage || !isSalesStage(row.sales_stage)) {
      return { ok: false, message: "Lead not found." } as LeadActionResult;
    }
    if (!isForwardSalesStageMove(row.sales_stage, target)) {
      return { ok: true } as LeadActionResult;
    }
    return updateLeadSalesStage(leadId, target, { allowBooked: target === "booked" });
  });
  return result as LeadActionResult;
}

/** Board / detail: move to a sales stage key (not a pipeline_templates stage id). */
export async function updateLeadPipelineStage(leadId: string, stageKey: string): Promise<LeadActionResult> {
  return updateLeadSalesStage(leadId, stageKey);
}

/**
 * Deliberate Booked → Sales Pipeline return.
 * Destination is the pipeline entry stage (new_inquiry) — never invents prior-stage history.
 * Preserves client/event/documents/financials/first_booked_at (stage-only change).
 */
export async function moveLeadBackToSalesPipeline(leadId: string): Promise<LeadActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const { data: row } = await supabase.from("leads").select("sales_stage")
      .eq("id", leadId).eq("venue_id", venueId)
      .maybeSingle<{ sales_stage: string | null }>();
    if (!row) return { ok: false, message: "Lead not found." } as LeadActionResult;
    if (row.sales_stage !== "booked") {
      return { ok: false, message: "This lead is not currently Booked." } as LeadActionResult;
    }
    return updateLeadSalesStage(leadId, SALES_PIPELINE_RETURN_STAGE, { allowLeaveBooked: true });
  });
  return result as LeadActionResult;
}

/**
 * Return a previously converted relationship to Booked (rebooking when first_booked_at already set).
 * Requires an existing linked client — does not create a new client/event.
 */
export async function returnLeadToBooked(leadId: string): Promise<LeadActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const { data: row } = await supabase.from("leads").select("sales_stage")
      .eq("id", leadId).eq("venue_id", venueId)
      .maybeSingle<{ sales_stage: string | null }>();
    if (!row) return { ok: false, message: "Lead not found." } as LeadActionResult;
    if (row.sales_stage === "booked") {
      return { ok: true } as LeadActionResult;
    }
    const { data: linked } = await supabase.from("clients").select("id")
      .eq("lead_id", leadId).eq("venue_id", venueId)
      .maybeSingle<{ id: string }>();
    if (!linked) {
      return {
        ok: false,
        message: "Book This Lead first — there is no client linked to this inquiry yet.",
      } as LeadActionResult;
    }
    return updateLeadSalesStage(leadId, "booked", { allowBooked: true, clientId: linked.id });
  });
  return result as LeadActionResult;
}

export async function wouldEnrollOnPipelineStageMove(
  leadId: string,
  stageKey: string,
): Promise<
  | { ok: true; wouldEnroll: boolean; preview: AutomationMessagePreview | null }
  | { ok: false; message: string }
> {
  if (!isSalesStage(stageKey)) return { ok: false, message: "Invalid sales stage." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { data: lead } = await supabase.from("leads").select("relationship_id")
    .eq("id", leadId).eq("venue_id", venue.id)
    .maybeSingle<{ relationship_id: string | null }>();
  if (!lead?.relationship_id) return { ok: true, wouldEnroll: false, preview: null };
  const check = await wouldEnrollOnStageChange(supabase, venue.id, lead.relationship_id, stageKey);
  let preview: AutomationMessagePreview | null = null;
  if (check.wouldEnroll && check.sequenceId) {
    preview = await previewFirstStepForSequence(supabase, venue.id, check.sequenceId, lead.relationship_id);
  }
  return { ok: true, wouldEnroll: check.wouldEnroll, preview };
}

/**
 * Ensure Standard Sales Pipeline library record exists (idempotent).
 * Does not control live Board stages.
 */
export async function ensureStandardSalesPipelineForCurrentVenue(): Promise<void> {
  if (!isSupabaseConfigured) return;
  const venue = await getCurrentVenue();
  if (!venue) return;
  const supabase = await createClient();
  await supabase.rpc("ensure_standard_sales_pipeline", { p_venue_id: venue.id });
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
    try {
      await repo.updateRelationshipFields(supabase, venueId, leadId, input);
    } catch (err) {
      if (err instanceof LeadTourWriteError) {
        return { ok: false, message: err.message || TOUR_TIME_REQUIRED } as LeadActionResult;
      }
      const fail = tourCapacityFailureFromUnknown(err);
      if (fail) {
        return {
          ok: false,
          message: "That time is no longer available. Please choose another time.",
        } as LeadActionResult;
      }
      throw err;
    }
    // Log specific meaningful events rather than a generic "updated".
    if (activityHints.tourScheduled && input.tourDate && input.tourTime) {
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
