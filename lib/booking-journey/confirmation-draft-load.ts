import { createClient } from "@/integrations/supabase/server";
import { getSpaces } from "@/lib/availability/repository";
import { effectiveMaxSimultaneousEvents } from "@/lib/availability/event-occupancy";
import {
  prefillBookingConfirmation,
  type BookingConfirmationDraft,
} from "@/lib/booking-journey/confirmation-draft";
import type { LeadSpacePreferenceKind } from "@/lib/leads/space-preferences";
import { labelForUseKey } from "@/lib/venue-spaces/uses";
import { getCurrentVenue } from "@/lib/venue/service";

type DraftResult =
  | { ok: true; draft: BookingConfirmationDraft }
  | { ok: false; message: string };

async function venueContext(): Promise<
  | { ok: false; message: string }
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createClient>>;
      venueId: string;
      spaces: BookingConfirmationDraft["spaces"];
      maxSimultaneousEvents: number;
      spaceOperatingMode: "single" | "multi";
    }
> {
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const spaces = await getSpaces(supabase, venue.id);
  const { data: rules } = await supabase
    .from("venue_capacity_rules")
    .select("max_simultaneous_events")
    .eq("venue_id", venue.id)
    .maybeSingle<{ max_simultaneous_events: number | null }>();
  const { data: modeRow } = await supabase
    .from("venues")
    .select("space_operating_mode")
    .eq("id", venue.id)
    .maybeSingle<{ space_operating_mode: string | null }>();
  return {
    ok: true,
    supabase,
    venueId: venue.id,
    spaces,
    maxSimultaneousEvents: effectiveMaxSimultaneousEvents({
      maxSimultaneousEvents: rules?.max_simultaneous_events ?? 1,
    }),
    spaceOperatingMode: modeRow?.space_operating_mode === "multi" ? "multi" : "single",
  };
}

export async function loadBookingConfirmationDraft(leadId: string): Promise<DraftResult> {
  const ctx = await venueContext();
  if (!ctx.ok) return ctx;
  const { supabase, venueId } = ctx;
  const { data: lead } = await supabase
    .from("leads")
    .select("id, event_type, event_date, end_date, planned_event_space_id")
    .eq("id", leadId)
    .eq("venue_id", venueId)
    .maybeSingle<{
      id: string;
      event_type: string | null;
      event_date: string | null;
      end_date: string | null;
      planned_event_space_id: string | null;
    }>();
  if (!lead) return { ok: false, message: "Lead not found." };

  const { data: client } = await supabase
    .from("clients")
    .select("id, event_date, end_date, ceremony_time, reception_time")
    .eq("lead_id", leadId)
    .eq("venue_id", venueId)
    .maybeSingle<{
      id: string;
      event_date: string | null;
      end_date: string | null;
      ceremony_time: string | null;
      reception_time: string | null;
    }>();

  return finishDraft(ctx, {
    leadId,
    clientId: client?.id ?? null,
    eventType: lead.event_type,
    eventDate: client?.event_date ?? lead.event_date,
    endDate: client?.end_date ?? lead.end_date,
    plannedSpaceId: lead.planned_event_space_id,
    ceremonyTime: client?.ceremony_time ?? null,
    receptionTime: client?.reception_time ?? null,
  });
}

export async function loadBookingConfirmationDraftForClient(clientId: string): Promise<DraftResult> {
  const ctx = await venueContext();
  if (!ctx.ok) return ctx;
  const { supabase, venueId } = ctx;
  const { data: client } = await supabase
    .from("clients")
    .select("id, lead_id, event_type, event_date, end_date, ceremony_time, reception_time")
    .eq("id", clientId)
    .eq("venue_id", venueId)
    .maybeSingle<{
      id: string;
      lead_id: string | null;
      event_type: string | null;
      event_date: string | null;
      end_date: string | null;
      ceremony_time: string | null;
      reception_time: string | null;
    }>();
  if (!client) return { ok: false, message: "Client not found." };
  let planned: string | null = null;
  let eventType = client.event_type;
  let eventDate = client.event_date;
  let endDate = client.end_date;
  if (client.lead_id) {
    const { data: lead } = await supabase
      .from("leads")
      .select("event_type, event_date, end_date, planned_event_space_id")
      .eq("id", client.lead_id)
      .eq("venue_id", venueId)
      .maybeSingle<{
        event_type: string | null;
        event_date: string | null;
        end_date: string | null;
        planned_event_space_id: string | null;
      }>();
    planned = lead?.planned_event_space_id ?? null;
    eventType = eventType ?? lead?.event_type ?? null;
    eventDate = eventDate ?? lead?.event_date ?? null;
    endDate = endDate ?? lead?.end_date ?? null;
  }
  return finishDraft(ctx, {
    leadId: client.lead_id,
    clientId: client.id,
    eventType,
    eventDate,
    endDate,
    plannedSpaceId: planned,
    ceremonyTime: client.ceremony_time,
    receptionTime: client.reception_time,
  });
}

async function finishDraft(
  ctx: Extract<Awaited<ReturnType<typeof venueContext>>, { ok: true }>,
  row: {
    leadId: string | null;
    clientId: string | null;
    eventType: string | null;
    eventDate: string | null;
    endDate: string | null;
    plannedSpaceId: string | null;
    ceremonyTime: string | null;
    receptionTime: string | null;
  },
): Promise<DraftResult> {
  const { supabase, venueId } = ctx;
  let eventStart: string | null = null;
  let eventEndTime: string | null = null;
  let eventSpace: string | null = null;
  let eventDate = row.eventDate;
  let endDate = row.endDate;
  const assignments: BookingConfirmationDraft["assignments"] = [];

  if (row.clientId) {
    const { data: event } = await supabase
      .from("events")
      .select("id, event_date, event_end_date, start_time, end_time, space_id")
      .eq("client_id", row.clientId)
      .eq("venue_id", venueId)
      .neq("status", "cancelled")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<{
        id: string;
        event_date: string | null;
        event_end_date: string | null;
        start_time: string | null;
        end_time: string | null;
        space_id: string | null;
      }>();
    if (event) {
      eventDate = event.event_date ?? eventDate;
      endDate = event.event_end_date ?? endDate;
      eventStart = event.start_time;
      eventEndTime = event.end_time;
      eventSpace = event.space_id;
      const { data: rows } = await supabase
        .from("event_space_assignments")
        .select("use_key, use_label, space_id, sort_order")
        .eq("event_id", event.id)
        .eq("venue_id", venueId)
        .order("sort_order");
      for (const assignment of rows ?? []) {
        assignments.push({
          useKey: assignment.use_key,
          useLabel: assignment.use_label || labelForUseKey(assignment.use_key),
          spaceId: assignment.space_id,
        });
      }
    }
  }

  const holds = row.leadId
    ? (await supabase
      .from("date_holds")
      .select("status, hold_date, start_time, end_time, space_id")
      .eq("lead_id", row.leadId)
      .eq("venue_id", venueId)
      .eq("status", "active")).data ?? []
    : [];

  const preferences = row.leadId
    ? (await supabase
      .from("lead_event_space_preferences")
      .select("use_key, preference_kind, space_id")
      .eq("lead_id", row.leadId)
      .eq("venue_id", venueId)).data ?? []
    : [];

  const prefill = prefillBookingConfirmation({
    eventType: row.eventType,
    eventDate,
    endDate,
    plannedSpaceId: eventSpace ?? row.plannedSpaceId,
    holds: holds.map((hold) => ({
      status: "active" as const,
      holdDate: hold.hold_date,
      startTime: hold.start_time,
      endTime: hold.end_time,
      spaceId: hold.space_id,
      spaceIds: hold.space_id ? [hold.space_id] : [],
    })),
    preferences: preferences.map((pref) => ({
      useKey: pref.use_key,
      preferenceKind: pref.preference_kind as LeadSpacePreferenceKind,
      spaceId: pref.space_id,
      externalLocation: null,
    })),
    assignments,
  });

  if (!prefill.startTime && (eventStart || row.ceremonyTime)) {
    prefill.startTime = (eventStart ?? row.ceremonyTime ?? "").slice(0, 5);
  }
  if (!prefill.endTime && (eventEndTime || row.receptionTime)) {
    prefill.endTime = (eventEndTime ?? row.receptionTime ?? "").slice(0, 5);
  }

  return {
    ok: true,
    draft: {
      ...prefill,
      spaces: ctx.spaces,
      maxSimultaneousEvents: ctx.maxSimultaneousEvents,
      spaceOperatingMode: ctx.spaceOperatingMode,
    },
  };
}
