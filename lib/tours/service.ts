import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";
import type { BookingResult, TourSettings, TourSlot, TourVenueInfo } from "@/lib/tours/types";
import type { CalendarItem } from "@/lib/calendar/types";
import { eventTypeLabel } from "@/lib/leads/constants";

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
  const { data } = await client.from("tour_appointments")
    .select("id, scheduled_at, lead_id, event_type, leads(first_name, last_name, partner_first_name)")
    .eq("venue_id", venueId)
    .not("status", "in", "(cancelled,completed,no_show)")
    .gte("scheduled_at", `${start}T00:00:00`)
    .lte("scheduled_at", `${end}T23:59:59`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((t) => {
    const lead = t.leads as { first_name: string; last_name: string; partner_first_name: string | null } | null;
    const name = lead
      ? [lead.first_name, lead.last_name].join(" ") + (lead.partner_first_name ? ` & ${lead.partner_first_name}` : "")
      : (t.contact_name ?? "Unknown");
    const scheduledAt = new Date(t.scheduled_at as string);
    return {
      id: `tour-${t.id}`,
      type: "tour",
      date: scheduledAt.toISOString().slice(0, 10),
      title: `Venue Tour — ${name}`,
      subtitle: t.event_type ? eventTypeLabel(t.event_type) : null,
      time: scheduledAt.toISOString().slice(11, 16),
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
  };
}

export async function getTourSlots(key: string, startDate: string, endDate: string): Promise<TourSlot[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_tour_slots", { p_embed_key: key, p_start_date: startDate, p_end_date: endDate });
  if (!data || (data as Record<string, unknown>).error) return [];
  return ((data as Record<string, unknown>).slots ?? []) as TourSlot[];
}

export async function bookTour(
  key: string,
  slotStart: string,
  fields: { firstName: string; lastName: string; partnerName: string; email: string; phone: string; eventType: string; eventDate: string; guestCount: number | null; notes: string },
): Promise<BookingResult> {
  if (!isSupabaseConfigured) return { ok: false, error: "Backend not configured." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("book_tour", {
    p_embed_key: key, p_slot_start: slotStart,
    p_first_name: fields.firstName, p_last_name: fields.lastName, p_partner_name: fields.partnerName,
    p_email: fields.email, p_phone: fields.phone, p_event_type: fields.eventType,
    p_event_date: fields.eventDate || null, p_guest_count: fields.guestCount,
    p_notes: fields.notes,
  });
  if (error) return { ok: false, error: error.message };
  const d = data as Record<string, unknown>;
  if (!d?.ok) {
    const msg: Record<string, string> = {
      slot_taken: "This slot was just booked. Please choose another time.",
      slot_too_soon: "Please choose a time at least 24 hours from now.",
      slot_too_far: "This slot is too far in the future.",
      invalid_key: "This booking link is not valid.",
    };
    return { ok: false, error: msg[d?.error as string] ?? "Could not book this slot. Please try again." };
  }
  const appointmentId = d.appointmentId as string;

  // Fetch venue email + id for coordinator notification (non-blocking if this fails)
  const { data: apptRow } = await supabase
    .from("tour_appointments")
    .select("venue_id, contact_email, contact_name, venues(email)")
    .eq("id", appointmentId)
    .maybeSingle<{ venue_id: string; contact_email: string | null; contact_name: string | null; venues: { email: string | null } | null }>();

  return {
    ok: true,
    leadId: d.leadId as string,
    appointmentId,
    scheduledAt: d.scheduledAt as string,
    venueName: d.venueName as string,
    duration: d.duration as number,
    venueId: apptRow?.venue_id,
    venueEmail: apptRow?.venues?.email ?? null,
    contactEmail: apptRow?.contact_email ?? fields.email,
    contactName: apptRow?.contact_name ?? `${fields.firstName} ${fields.lastName}`.trim(),
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

export async function getTourAppointments(): Promise<import("@/lib/tours/types").TourAppointment[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("tour_appointments").select("*, leads(first_name,last_name,partner_first_name)").eq("venue_id", venue.id).order("scheduled_at", { ascending: false }).limit(50);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map(mapAppointment);
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
  return { id: r.id, venueId: r.venue_id, leadId: r.lead_id ?? null, scheduledAt: r.scheduled_at, durationMinutes: r.duration_minutes, status: r.status, contactName: r.contact_name ?? null, contactEmail: r.contact_email ?? null, contactPhone: r.contact_phone ?? null, eventType: r.event_type ?? null, eventDate: r.event_date ?? null, guestCount: r.guest_count ?? null, notes: r.notes ?? null, assignedTo: r.assigned_to ?? null, confirmedAt: r.confirmed_at ?? null, completedAt: r.completed_at ?? null, followUpSentAt: r.follow_up_sent_at ?? null, outcome: r.outcome ?? null, createdAt: r.created_at };
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
