import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";
import { getVenueTimezone, utcToVenueLocalParts } from "@/lib/venue/timezone";
import type { BookingResult, CoordinatorTourResult, SimpleTourResult, TourAvailabilityException, TourAvailabilityExceptionInput, TourAvailabilityWindow, TourAvailabilityWindowInput, TourSettings, TourSlot, TourVenueInfo } from "@/lib/tours/types";
import type { CalendarItem } from "@/lib/calendar/types";
import { eventTypeLabel, leadDisplayName } from "@/lib/leads/constants";
import { sendTourConfirmation } from "@/lib/tours/communication";
import { updateLeadStatus } from "@/lib/leads/service";
import { ingestLead } from "@/lib/lead-intake/pipeline";
import { recordNotificationStatus } from "@/lib/lead-intake/attempt-log";

type DbClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Tours' own calendar projection (Program 2 Phase 1b) — the Calendar
 * aggregator composes this rather than reaching into tour_appointments
 * directly, so tours' schema is only ever known here. This is also the fix
 * for TR-B4: the calendar used to read the legacy leads.tour_date field
 * (now dropped), which silently never reflected tours booked through the
 * public widget.
 */
export async function getTourCalendarEntries(
  client: DbClient,
  venueId: string,
  start: string,
  end: string,
): Promise<CalendarItem[]> {
  const [{ data }, timezone] = await Promise.all([
    client.from("tour_appointments")
      .select("id, scheduled_at, lead_id, event_type, leads(first_name, last_name, partner_first_name)")
      .eq("venue_id", venueId)
      .not("status", "in", "(cancelled,completed,no_show)")
      .gte("scheduled_at", `${start}T00:00:00`)
      .lte("scheduled_at", `${end}T23:59:59`),
    getVenueTimezone(client, venueId),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((t) => {
    const lead = t.leads as { first_name: string; last_name: string; partner_first_name: string | null } | null;
    const name = lead
      ? [lead.first_name, lead.last_name].join(" ") + (lead.partner_first_name ? ` & ${lead.partner_first_name}` : "")
      : (t.contact_name ?? "Unknown");
    // Venue-local, not the UTC wall clock the stored timestamptz would give
    // if extracted directly — a tour booked for 10:00 America/New_York
    // correctly stores as 14:00 UTC; displaying "14:00" without converting
    // back was the actual bug.
    const { date, time } = utcToVenueLocalParts(t.scheduled_at as string, timezone);
    return {
      id: `tour-${t.id}`,
      type: "tour",
      date,
      title: `Venue Tour — ${name}`,
      subtitle: t.event_type ? eventTypeLabel(t.event_type) : null,
      time,
      link: t.lead_id ? `/leads/${t.lead_id}` : "/tours",
    };
  });
}

// ── Public (no auth) ----------------------------------------------------------

export async function getVenueByTourKey(key: string): Promise<TourVenueInfo | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_venue_by_tour_key", { p_key: key });
  if (!data || (data as Record<string, unknown>).error) return null;
  const d = data as Record<string, unknown>;
  return {
    name: d.name as string,
    headline: (d.headline as string) ?? "Schedule a Tour",
    description: (d.description as string | null) ?? null,
    duration: (d.duration as number) ?? 60,
    email: (d.email as string | null) ?? null,
    phone: (d.phone as string | null) ?? null,
    addressLine1: (d.addressLine1 as string | null) ?? null,
    city: (d.city as string | null) ?? null,
    stateRegion: (d.stateRegion as string | null) ?? null,
    primaryColor: (d.primaryColor as string) ?? "#5D6F5D",
    secondaryColor: (d.secondaryColor as string) ?? "#4F5F4F",
    accentColor: (d.accentColor as string) ?? "#B8AEA1",
    neutralColor: (d.neutralColor as string) ?? "#F7F5F1",
    logoUrl: (d.logoUrl as string | null) ?? null,
  };
}

export async function getTourSlots(key: string, startDate: string, endDate: string): Promise<TourSlot[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_tour_slots", { p_embed_key: key, p_start_date: startDate, p_end_date: endDate });
  if (!data || (data as Record<string, unknown>).error) return [];
  return ((data as Record<string, unknown>).slots ?? []) as TourSlot[];
}

const TOUR_BOOK_ERRORS: Record<string, string> = {
  slot_taken: "This slot was just booked. Please choose another time.",
  slot_too_soon: "Please choose a time at least 24 hours from now.",
  slot_too_far: "This slot is too far in the future.",
  invalid_key: "This booking link is not valid.",
};

export async function bookTour(
  key: string,
  slotStart: string,
  fields: { firstName: string; lastName: string; partnerName: string; email: string; phone: string; eventType: string; eventDate: string; guestCount: number | null; notes: string },
  opts?: { turnstileToken?: string | null; ipAddress?: string | null; qrCampaignId?: string | null },
): Promise<BookingResult> {
  if (!isSupabaseConfigured) return { ok: false, error: "Backend not configured." };

  // Found while verifying this pass, not assumed: this route has no
  // session (it's public), and `anon` turns out to have zero grants on
  // tour_appointments at all — confirmed directly against PostgREST
  // ("permission denied for table tour_appointments"). Same TR-M7 pattern
  // as every other session-less route in this codebase: the admin client,
  // used throughout this function (including the Lead Intake pipeline call
  // below) rather than mixing it with a second, anon-key client.
  const admin = createAdminClient();

  // Venue resolution happens up front (not only inside book_tour) so the
  // Lead Intake pipeline can log/rate-limit against a known venue_id before
  // the RPC call — book_tour still independently re-validates the key.
  const { data: venueRow } = await admin
    .from("venues")
    .select("id")
    .eq("tour_embed_key", key)
    .eq("tour_scheduling_enabled", true)
    .maybeSingle<{ id: string }>();

  if (!venueRow) {
    return { ok: false, error: TOUR_BOOK_ERRORS.invalid_key };
  }

  // book_tour's own response carries booking-specific fields (appointmentId,
  // venueName, scheduledAt, duration) that don't belong on CreateOutcome —
  // captured via this closure variable rather than smuggled through the
  // pipeline's generic result shape.
  let booking: Record<string, unknown> | null = null;

  const outcome = await ingestLead({
    supabase: admin,
    venueId: venueRow.id,
    source: "tour_scheduling",
    trustTier: "direct",
    ipAddress: opts?.ipAddress ?? null,
    turnstileToken: opts?.turnstileToken ?? null,
    rawPayload: { key, slotStart, fields },
    input: {
      firstName: fields.firstName,
      lastName: fields.lastName,
      partnerFirstName: fields.partnerName,
      email: fields.email,
      phone: fields.phone,
      eventType: fields.eventType,
      eventDate: fields.eventDate || null,
      guestCount: fields.guestCount,
      inquiryMessage: fields.notes,
    },
    create: async (normalized) => {
      const { data, error } = await admin.rpc("book_tour", {
        p_embed_key: key, p_slot_start: slotStart,
        p_first_name: normalized.firstName, p_last_name: normalized.lastName,
        p_partner_name: normalized.partnerFirstName ?? "",
        p_email: normalized.email ?? "", p_phone: normalized.phone ?? "",
        p_event_type: normalized.eventType ?? "", p_event_date: normalized.eventDate,
        p_guest_count: normalized.guestCount, p_notes: normalized.inquiryMessage ?? "",
        p_qr_campaign_id: opts?.qrCampaignId ?? null,
      });
      if (error) return { ok: false, error: error.message };
      const d = data as Record<string, unknown>;
      if (!d?.ok) {
        return { ok: false, error: TOUR_BOOK_ERRORS[d?.error as string] ?? "Could not book this slot. Please try again." };
      }
      const { data: leadRow } = await admin.from("leads").select("relationship_id")
        .eq("id", d.leadId as string).maybeSingle<{ relationship_id: string | null }>();
      if (!leadRow?.relationship_id) return { ok: false, error: "Lead created without a relationship." };
      const { count } = await admin.from("leads")
        .select("id", { count: "exact", head: true })
        .eq("relationship_id", leadRow.relationship_id);
      booking = d;
      return {
        ok: true,
        leadId: d.leadId as string,
        relationshipId: leadRow.relationship_id,
        isReturningRelationship: (count ?? 0) > 1,
      };
    },
  });

  if (!outcome.ok || !booking) {
    return { ok: false, error: outcome.ok ? "Could not book this slot. Please try again." : outcome.error };
  }

  const confirmedBooking = booking as Record<string, unknown>;
  const appointmentId = confirmedBooking.appointmentId as string;
  const leadId = outcome.leadId;
  const venueName = confirmedBooking.venueName as string;
  const scheduledAt = confirmedBooking.scheduledAt as string;
  const duration = confirmedBooking.duration as number;
  const relationshipId = outcome.relationshipId;

  const { data: apptRow } = await admin
    .from("tour_appointments")
    .select("contact_email, contact_name, contact_phone, venues(email, primary_color)")
    .eq("id", appointmentId)
    .maybeSingle<{ contact_email: string | null; contact_name: string | null; contact_phone: string | null; venues: { email: string | null; primary_color: string | null } | null }>();

  const contactEmail = apptRow?.contact_email ?? fields.email;
  const contactName = apptRow?.contact_name ?? `${fields.firstName} ${fields.lastName}`.trim();
  const venueId = venueRow.id;

  // Same confirmation, same pipeline, whether the website or a coordinator
  // booked it — see lib/tours/communication.ts. Never blocks the response;
  // a failed send must not fail a booking that already succeeded. Already
  // tracks its own delivery status durably in conversation_messages; also
  // recorded onto the intake attempt so a coordinator can see it from there too.
  void sendTourConfirmation({
    venueId, leadId, relationshipId, contactEmail, contactName,
    venueName, primaryColor: apptRow?.venues?.primary_color ?? null, scheduledAt, durationMinutes: duration,
  }).then(
    () => recordNotificationStatus(admin, outcome.attemptId, "sent"),
    (err) => { console.error("sendTourConfirmation failed:", err); void recordNotificationStatus(admin, outcome.attemptId, "failed"); },
  );

  return {
    ok: true,
    leadId,
    relationshipId,
    appointmentId,
    scheduledAt,
    venueName,
    duration,
    venueId,
    intakeAttemptId: outcome.attemptId,
    venueEmail: apptRow?.venues?.email ?? null,
    contactEmail,
    contactName,
    contactPhone: apptRow?.contact_phone ?? fields.phone,
  };
}

// ── Coordinator (authenticated) -----------------------------------------------

export async function getTourSettings(): Promise<TourSettings | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("venues").select("tour_scheduling_enabled,tour_embed_key,tour_duration_minutes,tour_min_notice_hours,tour_max_advance_days,tour_buffer_minutes,tour_page_headline,tour_page_description").eq("id", venue.id).maybeSingle<Record<string, unknown>>();
  if (!data) return null;
  return { tourSchedulingEnabled: data.tour_scheduling_enabled as boolean, tourEmbedKey: data.tour_embed_key as string, tourDurationMinutes: data.tour_duration_minutes as number, tourMinNoticeHours: data.tour_min_notice_hours as number, tourMaxAdvanceDays: data.tour_max_advance_days as number, tourBufferMinutes: data.tour_buffer_minutes as number, tourPageHeadline: (data.tour_page_headline ?? null) as string | null, tourPageDescription: (data.tour_page_description ?? null) as string | null };
}

export async function updateTourSettings(patch: Partial<Omit<TourSettings, "tourEmbedKey">>): Promise<{ ok: boolean }> {
  if (!isSupabaseConfigured) return { ok: false };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false };
  const supabase = await createClient();
  const dbPatch: Record<string, unknown> = {};
  if (patch.tourSchedulingEnabled !== undefined) dbPatch.tour_scheduling_enabled = patch.tourSchedulingEnabled;
  if (patch.tourDurationMinutes !== undefined) dbPatch.tour_duration_minutes = patch.tourDurationMinutes;
  if (patch.tourMinNoticeHours !== undefined) dbPatch.tour_min_notice_hours = patch.tourMinNoticeHours;
  if (patch.tourMaxAdvanceDays !== undefined) dbPatch.tour_max_advance_days = patch.tourMaxAdvanceDays;
  if (patch.tourBufferMinutes !== undefined) dbPatch.tour_buffer_minutes = patch.tourBufferMinutes;
  if (patch.tourPageHeadline !== undefined) dbPatch.tour_page_headline = patch.tourPageHeadline || null;
  if (patch.tourPageDescription !== undefined) dbPatch.tour_page_description = patch.tourPageDescription || null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("venues") as any).update(dbPatch).eq("id", venue.id);
  return { ok: !error };
}

// ── Weekly availability + exceptions (Tour Scheduling Completion) ------------

export async function getTourAvailabilityWindows(): Promise<TourAvailabilityWindow[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("tour_availability_windows")
    .select("id, day_of_week, start_time, end_time, sort_order")
    .eq("venue_id", venue.id)
    .order("day_of_week").order("sort_order").order("start_time");
  return ((data ?? []) as { id: string; day_of_week: number; start_time: string; end_time: string; sort_order: number }[])
    .map((r) => ({ id: r.id, dayOfWeek: r.day_of_week, startTime: r.start_time.slice(0, 5), endTime: r.end_time.slice(0, 5), sortOrder: r.sort_order }));
}

/**
 * Full replace, not a per-row upsert — there's no unique (venue_id,
 * day_of_week) constraint here the way venue_business_hours has, since
 * multiple windows per day are the whole point. A day with zero windows
 * in the input is simply closed; the caller (the Settings UI) is
 * responsible for only submitting windows for enabled days.
 */
export async function replaceTourAvailabilityWindows(windows: TourAvailabilityWindowInput[]): Promise<{ ok: boolean }> {
  if (!isSupabaseConfigured) return { ok: false };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false };
  const supabase = await createClient();
  const { error: deleteError } = await supabase.from("tour_availability_windows").delete().eq("venue_id", venue.id);
  if (deleteError) return { ok: false };
  if (windows.length === 0) return { ok: true };
  const rows = windows.map((w, i) => ({
    venue_id: venue.id, day_of_week: w.dayOfWeek, start_time: w.startTime, end_time: w.endTime, sort_order: i,
  }));
  const { error: insertError } = await supabase.from("tour_availability_windows").insert(rows);
  return { ok: !insertError };
}

export async function getTourAvailabilityExceptions(): Promise<TourAvailabilityException[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("tour_availability_exceptions")
    .select("id, start_date, end_date, label")
    .eq("venue_id", venue.id)
    .order("start_date");
  return ((data ?? []) as { id: string; start_date: string; end_date: string; label: string | null }[])
    .map((r) => ({ id: r.id, startDate: r.start_date, endDate: r.end_date, label: r.label }));
}

export async function addTourAvailabilityException(input: TourAvailabilityExceptionInput): Promise<{ ok: boolean }> {
  if (!isSupabaseConfigured) return { ok: false };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.from("tour_availability_exceptions").insert({
    venue_id: venue.id, start_date: input.startDate, end_date: input.endDate, label: input.label?.trim() || null,
  });
  return { ok: !error };
}

export async function removeTourAvailabilityException(id: string): Promise<{ ok: boolean }> {
  if (!isSupabaseConfigured) return { ok: false };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.from("tour_availability_exceptions").delete().eq("id", id).eq("venue_id", venue.id);
  return { ok: !error };
}

export async function getTourAppointments(): Promise<import("@/lib/tours/types").TourAppointment[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("tour_appointments").select("*, leads(first_name,last_name,partner_first_name)").eq("venue_id", venue.id).order("scheduled_at", { ascending: false }).limit(50);
  // The Tours list showed "Unknown" for appointments whose own
  // contact_name column was never populated (e.g. booked before that
  // column was consistently filled in) even though the linked Lead's name
  // was right there — the query already joined it, mapAppointment just
  // never read it. Same name the Lead's own page already shows.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => {
    const appt = mapAppointment(r);
    if (!appt.contactName && r.leads) {
      appt.contactName = leadDisplayName(r.leads.first_name, r.leads.last_name, r.leads.partner_first_name, null);
    }
    return appt;
  });
}

export async function getTourAppointmentsForLead(leadId: string): Promise<import("@/lib/tours/types").TourAppointment[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("tour_appointments").select("*").eq("venue_id", venue.id).eq("lead_id", leadId).order("scheduled_at");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map(mapAppointment);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAppointment(r: any): import("@/lib/tours/types").TourAppointment {
  return { id: r.id, venueId: r.venue_id, leadId: r.lead_id ?? null, scheduledAt: r.scheduled_at, durationMinutes: r.duration_minutes, status: r.status, contactName: r.contact_name ?? null, contactEmail: r.contact_email ?? null, contactPhone: r.contact_phone ?? null, eventType: r.event_type ?? null, eventDate: r.event_date ?? null, guestCount: r.guest_count ?? null, notes: r.notes ?? null, assignedTo: r.assigned_to ?? null, confirmedAt: r.confirmed_at ?? null, completedAt: r.completed_at ?? null, followUpSentAt: r.follow_up_sent_at ?? null, outcome: r.outcome ?? null, cancellationReason: r.cancellation_reason ?? null, createdAt: r.created_at };
}

// ── Coordinator Tour Scheduling — schedule/reschedule/cancel from a Lead -------
//
// Guiding principle: the Lead owns the scheduling workflow; the scheduling
// engine (business hours, conflict detection, tour_appointments) stays the
// single source of truth. These call the exact same conflict-checked RPCs
// the public widget's book_tour() uses (via a shared internal SQL
// function) — never a second implementation of "is this slot free."

export async function getCoordinatorTourSlots(startDate: string, endDate: string): Promise<TourSlot[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_coordinator_tour_slots", { p_start_date: startDate, p_end_date: endDate });
  if (!data || (data as Record<string, unknown>).error) return [];
  return ((data as Record<string, unknown>).slots ?? []) as TourSlot[];
}

const TOUR_RPC_ERRORS: Record<string, string> = {
  unauthorized: "Session expired.",
  lead_not_found: "This lead could not be found.",
  not_found: "This tour could not be found.",
  slot_taken: "This slot was just booked. Please choose another time.",
  slot_too_soon: "Please choose a time further in advance.",
  slot_too_far: "This slot is too far in the future.",
  venue_closed: "The venue is closed that day — please choose another date.",
  not_reschedulable: "This tour can't be rescheduled — it's already cancelled, completed, or marked no-show.",
  invalid_status: "That's not a valid tour status.",
};

async function sendConfirmationForResult(supabase: DbClient, appointmentId: string, leadId: string, relationshipId: string | null, venueId: string, venueName: string, primaryColor: string | null, scheduledAt: string, duration: number, contactEmail: string | null, contactName: string | null) {
  void sendTourConfirmation({
    venueId, leadId, relationshipId, contactEmail, contactName, venueName, primaryColor, scheduledAt, durationMinutes: duration,
  }).catch((err) => console.error("sendTourConfirmation failed:", err));
}

export async function scheduleTourForLead(leadId: string, slotStart: string, notes?: string): Promise<CoordinatorTourResult> {
  if (!isSupabaseConfigured) return { ok: false, error: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, error: "Session expired." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("book_tour_for_lead", { p_lead_id: leadId, p_slot_start: slotStart, p_notes: notes ?? null });
  if (error) return { ok: false, error: error.message };
  const d = data as Record<string, unknown>;
  if (!d?.ok) return { ok: false, error: TOUR_RPC_ERRORS[d?.error as string] ?? "Could not schedule this tour." };

  const result: CoordinatorTourResult = {
    ok: true,
    appointmentId: d.appointmentId as string,
    leadId: d.leadId as string,
    relationshipId: (d.relationshipId as string | null) ?? null,
    scheduledAt: d.scheduledAt as string,
    venueName: d.venueName as string,
    venueId: d.venueId as string,
    duration: d.duration as number,
    contactName: (d.contactName as string | null) ?? null,
    contactEmail: (d.contactEmail as string | null) ?? null,
    contactPhone: (d.contactPhone as string | null) ?? null,
  };

  await sendConfirmationForResult(supabase, result.appointmentId, result.leadId, result.relationshipId, result.venueId, result.venueName, venue.primaryColor, result.scheduledAt, result.duration, result.contactEmail, result.contactName);

  // "Tour Scheduled" is a real step in the Sales Pipeline — a lead that's
  // still sitting at "new" moves to "contacted" (the canonical "tour"
  // stage's mapped status) the moment a tour is actually on the books.
  // Never regresses a lead already further along (qualified, proposal
  // sent, etc.) — this only ever moves a pipeline forward.
  const { data: leadRow } = await supabase.from("leads").select("status").eq("id", leadId).maybeSingle<{ status: string }>();
  if (leadRow?.status === "new") {
    await updateLeadStatus(leadId, "contacted").catch((err) => console.error("Lead stage advance on tour scheduling failed:", err));
  }

  return result;
}

export async function rescheduleTour(appointmentId: string, newSlotStart: string): Promise<CoordinatorTourResult> {
  if (!isSupabaseConfigured) return { ok: false, error: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, error: "Session expired." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reschedule_tour", { p_appointment_id: appointmentId, p_new_slot_start: newSlotStart });
  if (error) return { ok: false, error: error.message };
  const d = data as Record<string, unknown>;
  if (!d?.ok) return { ok: false, error: TOUR_RPC_ERRORS[d?.error as string] ?? "Could not reschedule this tour." };

  const result: CoordinatorTourResult = {
    ok: true,
    appointmentId,
    leadId: d.leadId as string,
    relationshipId: null,
    scheduledAt: d.scheduledAt as string,
    oldScheduledAt: d.oldScheduledAt as string,
    venueName: d.venueName as string,
    venueId: d.venueId as string,
    duration: d.duration as number,
    contactName: (d.contactName as string | null) ?? null,
    contactEmail: (d.contactEmail as string | null) ?? null,
    contactPhone: (d.contactPhone as string | null) ?? null,
  };

  // Relationship id isn't returned by reschedule_tour (the row already
  // exists) — resolve it the same way the Lead page already does.
  if (result.leadId) {
    const { data: leadRow } = await supabase.from("leads").select("relationship_id").eq("id", result.leadId).maybeSingle<{ relationship_id: string | null }>();
    result.relationshipId = leadRow?.relationship_id ?? null;
  }

  await sendConfirmationForResult(supabase, result.appointmentId, result.leadId, result.relationshipId, result.venueId, result.venueName, venue.primaryColor, result.scheduledAt, result.duration, result.contactEmail, result.contactName);

  return result;
}

const STATUS_TO_SIGNAL: Record<string, string> = {
  completed: "tour_attended",
  cancelled: "tour_cancelled",
  no_show:   "tour_cancelled",
};
const POST_TOUR_STATUSES = new Set(["completed", "no_show", "cancelled"]);

/**
 * Confirm / Complete / No-show / Cancel — one implementation, two callers:
 * PATCH /api/tours/status (the Tours page's own dropdown, already built)
 * and the new "Reschedule / Cancel" actions on the Lead page. Previously
 * this logic lived only inside the route handler; extracted here so a
 * second entry point doesn't mean a second implementation of what
 * completing, no-showing, or cancelling a tour actually does — including
 * the real side effects (post-tour automation, signal tracking, clearing
 * pending reminders) that already existed and must not be dropped or
 * duplicated by a naive rewrite.
 */
export async function updateTourStatus(
  appointmentId: string,
  status: "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show",
  reason?: string,
): Promise<SimpleTourResult> {
  if (!isSupabaseConfigured) return { ok: false, error: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, error: "Session expired." };
  const supabase = await createClient();

  const { data: appt } = await supabase.from("tour_appointments")
    .select("status, lead_id, contact_name, scheduled_at")
    .eq("id", appointmentId).eq("venue_id", venue.id)
    .maybeSingle<{ status: string; lead_id: string | null; contact_name: string | null; scheduled_at: string }>();
  if (!appt) return { ok: false, error: "This tour could not be found." };

  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "cancelled") patch.cancellation_reason = reason?.trim() || null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("tour_appointments") as any).update(patch).eq("id", appointmentId).eq("venue_id", venue.id);
  if (error) return { ok: false, error: error.message };

  if (status === "cancelled" || status === "no_show") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("task_reminders") as any).update({ status: "cancelled" }).eq("tour_appointment_id", appointmentId).eq("status", "pending");
  }

  if (POST_TOUR_STATUSES.has(status) && appt.status !== status) {
    const { runPostTourAutomation } = await import("@/lib/tours/post-tour");
    void runPostTourAutomation(
      { supabase, appointmentId, venueId: venue.id, leadId: appt.lead_id, contactName: appt.contact_name, scheduledAt: appt.scheduled_at },
      status,
    ).catch((err) => console.error("[post-tour]", err));

    const signalType = STATUS_TO_SIGNAL[status];
    if (signalType && appt.lead_id) {
      void supabase.from("lead_signal_events").insert({
        venue_id: venue.id, lead_id: appt.lead_id, signal_type: signalType,
        signal_strength: status === "completed" ? 3 : 1,
        metadata: { appointment_id: appointmentId, status },
      }).then(null, () => {});
    }

    // Tour Completed Automation trigger — same path as lead_created / lead_stage_changed.
    if (status === "completed" && appt.lead_id) {
      void (async () => {
        const { data: lead } = await supabase.from("leads").select("relationship_id")
          .eq("id", appt.lead_id!).maybeSingle<{ relationship_id: string | null }>();
        if (!lead?.relationship_id) return;
        const { triggerSequencesForRelationship } = await import("@/lib/message-sequences/service");
        await triggerSequencesForRelationship(
          supabase, venue.id, lead.relationship_id, "tour_completed",
        );
      })().catch((e) => console.error("Series enrollment (tour_completed) failed:", e));
    }
  }

  return { ok: true };
}

export async function updateTourOutcome(
  appointmentId: string,
  patch: { outcome?: string | null; notes?: string | null; followUpSentAt?: string | null },
): Promise<{ ok: boolean }> {
  if (!isSupabaseConfigured) return { ok: false };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false };
  const supabase = await createClient();
  const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.outcome !== undefined) dbPatch.outcome = patch.outcome;
  if (patch.notes !== undefined) dbPatch.notes = patch.notes;
  if (patch.followUpSentAt !== undefined) dbPatch.follow_up_sent_at = patch.followUpSentAt;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("tour_appointments") as any).update(dbPatch).eq("id", appointmentId).eq("venue_id", venue.id);
  return { ok: !error };
}
