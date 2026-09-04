/**
 * Events application service. Server-only.
 */
import { occupancyFailureFromUnknown, calendarBlockFailureFromUnknown } from "@/lib/availability/event-occupancy";
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import * as repo from "@/lib/events/repository";
import { recalculateEventTaskDueDates } from "@/lib/playbooks/service";
import type {
  CreateEventResult,
  EventActionResult,
  EventInput,
  EventStatus,
  EventWithDetails,
  TeamMemberInput,
  VenueEvent,
} from "@/lib/events/types";
import { validateEventInput, validateEventStatus, validateTeamMemberInput } from "@/lib/events/validation";
import { normalizeEventEndDate } from "@/lib/events/constants";
import { syncEventVendorAvailability } from "@/lib/vendor-availability/sync";
import { getCurrentUserRole, getCurrentVenue } from "@/lib/venue/service";

function occupancyActionFailure(err: unknown): EventActionResult | CreateEventResult | null {
  const fail = occupancyFailureFromUnknown(err);
  if (fail) {
    const errors = fail.code === "missing_space" || fail.code === "invalid_space" || fail.code === "no_spaces"
      ? { spaceId: fail.message }
      : undefined;
    return { ok: false, message: fail.message, code: fail.code, errors };
  }
  const blocked = calendarBlockFailureFromUnknown(err);
  if (blocked) return { ok: false, message: blocked.message };
  return null;
}

async function withVenue<T>(
  fn: (supabase: Awaited<ReturnType<typeof createClient>>, venueId: string) => Promise<T>,
): Promise<T | EventActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expired." };
  return fn(supabase, venue.id);
}

// ---- read -------------------------------------------------------------------

export async function getEvents(filters?: { q?: string; status?: string }): Promise<VenueEvent[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getEvents(await createClient(), venue.id, filters);
}

export async function getEvent(eventId: string): Promise<EventWithDetails | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return repo.getEvent(await createClient(), venue.id, eventId);
}

export async function getEventIdForClient(clientId: string): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return repo.getEventIdForClient(await createClient(), venue.id, clientId);
}

// ---- create -----------------------------------------------------------------

export async function createEvent(input: EventInput): Promise<CreateEventResult> {
  const errors = validateEventInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const result = await withVenue(async (supabase, venueId) => {
    try {
      const eventId = await repo.insertEvent(supabase, venueId, input);
      return { ok: true, eventId } as CreateEventResult;
    } catch (err) {
      const fail = occupancyActionFailure(err);
      if (fail) return fail as CreateEventResult;
      throw err;
    }
  });
  return result as CreateEventResult;
}

// ---- update -----------------------------------------------------------------

export async function updateEvent_(eventId: string, input: EventInput): Promise<EventActionResult> {
  const errors = validateEventInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const result = await withVenue(async (supabase, venueId) => {
    const before = await repo.getEvent(supabase, venueId, eventId);
    try {
      await repo.updateEvent(supabase, venueId, eventId, input);
    } catch (err) {
      const fail = occupancyActionFailure(err);
      if (fail) return fail as EventActionResult;
      throw err;
    }
    await repo.insertEventActivity(supabase, venueId, eventId, "event_updated", "Event details updated");

    // Product Decisions (2026-07-08): relative due dates stay synchronized
    // with the event date automatically, until a task is explicitly
    // overridden. lib/playbooks handles which tasks that applies to.
    if (before && before.eventDate !== input.eventDate) {
      await recalculateEventTaskDueDates(eventId, input.eventDate);
    }

    // Move Booked availability when the secured event date range (or name) changes.
    const nextEnd = normalizeEventEndDate(input.eventDate, input.eventEndDate);
    if (
      before &&
      (before.eventDate !== input.eventDate
        || before.eventEndDate !== nextEnd
        || before.name !== input.name.trim())
    ) {
      await syncEventVendorAvailability(eventId, {
        eventDate:    input.eventDate,
        eventEndDate: nextEnd,
        eventName:    input.name.trim(),
        status:       before.status,
      });
    }

    return { ok: true } as EventActionResult;
  });
  return result as EventActionResult;
}

export async function updateEventStatus_(eventId: string, status: string): Promise<EventActionResult> {
  if (!validateEventStatus(status)) return { ok: false, message: `"${status}" is not a valid status.` };
  const result = await withVenue(async (supabase, venueId) => {
    const before = await repo.getEvent(supabase, venueId, eventId);
    try {
      await repo.updateEventStatus(supabase, venueId, eventId, status as EventStatus);
    } catch (err) {
      const fail = occupancyActionFailure(err);
      if (fail) return fail as EventActionResult;
      throw err;
    }
    // Cancel frees Booked days; restoring a cancelled event re-books them.
    // Do NOT stamp booked_at here — status changes are not the booking commitment moment.
    if (before && before.status !== status) {
      await syncEventVendorAvailability(eventId, {
        eventDate:    before.eventDate,
        eventEndDate: before.eventEndDate,
        eventName:    before.name,
        status,
      });
    }
    return { ok: true } as EventActionResult;
  });
  return result as EventActionResult;
}

/**
 * Owner/Manager correction of the booking commitment date (payment timing "At booking").
 * Never rewrites existing payment schedule due dates — those stay concrete until
 * the venue explicitly regenerates or edits lines.
 */
export async function updateEventBookedAt_(
  eventId: string,
  bookedAt: string,
): Promise<EventActionResult> {
  const date = bookedAt.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, errors: { bookedAt: "Enter a valid booking date." } };
  }
  const result = await withVenue(async (supabase, venueId) => {
    const role = await getCurrentUserRole();
    if (role !== "owner" && role !== "manager") {
      return { ok: false, message: "Only an Owner or Manager can set or correct the booking date." } as EventActionResult;
    }
    const before = await repo.getEvent(supabase, venueId, eventId);
    if (!before) return { ok: false, message: "Event not found." } as EventActionResult;
    await repo.setEventBookedAt(supabase, venueId, eventId, date);
    await repo.insertEventActivity(
      supabase, venueId, eventId, "event_updated",
      "Booking date updated",
      before.bookedAt
        ? `Booking date corrected to ${date}. Existing payment due dates were not changed.`
        : `Booking date set to ${date}. Existing payment due dates were not changed.`,
    );
    return { ok: true } as EventActionResult;
  });
  return result as EventActionResult;
}

// ---- notes ------------------------------------------------------------------

export async function addEventNote(eventId: string, body: string): Promise<EventActionResult> {
  if (!body.trim()) return { ok: false, message: "Note cannot be empty." };
  const result = await withVenue(async (supabase, venueId) => {
    await repo.insertEventNote(supabase, venueId, eventId, body);
    await repo.insertEventActivity(supabase, venueId, eventId, "note_added", "Note added");
    return { ok: true } as EventActionResult;
  });
  return result as EventActionResult;
}

export async function updateEventNote_(noteId: string, eventId: string, body: string): Promise<EventActionResult> {
  if (!body.trim()) return { ok: false, message: "Note cannot be empty." };
  const result = await withVenue(async (supabase, venueId) => {
    await repo.updateEventNote(supabase, venueId, noteId, body);
    await repo.insertEventActivity(supabase, venueId, eventId, "note_updated", "Note edited");
    return { ok: true } as EventActionResult;
  });
  return result as EventActionResult;
}

export async function deleteEventNote_(noteId: string): Promise<EventActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.deleteEventNote(supabase, venueId, noteId);
    return { ok: true } as EventActionResult;
  });
  return result as EventActionResult;
}

// ---- team -------------------------------------------------------------------

export async function addTeamMember(eventId: string, input: TeamMemberInput): Promise<EventActionResult> {
  const errors = validateTeamMemberInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors, message: errors.fullName };
  const result = await withVenue(async (supabase, venueId) => {
    const member = await repo.insertTeamMember(supabase, venueId, eventId, input);
    await repo.insertEventActivity(supabase, venueId, eventId, "team_updated",
      `Team member added: ${member.fullName}${input.role ? ` (${input.role})` : ""}`);
    return { ok: true } as EventActionResult;
  });
  return result as EventActionResult;
}

export async function removeTeamMember(memberId: string, memberName: string, eventId: string): Promise<EventActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.deleteTeamMember(supabase, venueId, memberId);
    await repo.insertEventActivity(supabase, venueId, eventId, "team_updated", `Team member removed: ${memberName}`);
    return { ok: true } as EventActionResult;
  });
  return result as EventActionResult;
}
