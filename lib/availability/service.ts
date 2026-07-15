/**
 * Availability application service. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import * as repo from "@/lib/availability/repository";
import type {
  AvailabilityActionResult,
  AvailabilityStatus,
  CalendarBlock,
  CalendarBlockInput,
  CreateHoldResult,
  CreateSpaceResult,
  DateHold,
  DateHoldInput,
  SpaceInput,
  VenueCapacityRules,
  VenueSpace,
} from "@/lib/availability/types";
import { getCurrentVenue } from "@/lib/venue/service";

async function withVenue<T>(
  fn: (supabase: Awaited<ReturnType<typeof createClient>>, venueId: string) => Promise<T>,
): Promise<T | AvailabilityActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expired." };
  return fn(supabase, venue.id);
}

// ---- Spaces -----------------------------------------------------------------

export async function getSpaces(): Promise<VenueSpace[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getSpaces(await createClient(), venue.id);
}

export async function createSpace(input: SpaceInput): Promise<CreateSpaceResult> {
  if (!input.name.trim()) return { ok: false, message: "Space name is required." };
  const result = await withVenue(async (supabase, venueId) => {
    const spaceId = await repo.insertSpace(supabase, venueId, input);
    return { ok: true, spaceId } as CreateSpaceResult;
  });
  return result as CreateSpaceResult;
}

export async function updateSpace_(spaceId: string, input: SpaceInput): Promise<AvailabilityActionResult> {
  if (!input.name.trim()) return { ok: false, message: "Space name is required." };
  const result = await withVenue(async (supabase, venueId) => {
    await repo.updateSpace(supabase, venueId, spaceId, input);
    return { ok: true } as AvailabilityActionResult;
  });
  return result as AvailabilityActionResult;
}

export async function deleteSpace_(spaceId: string): Promise<AvailabilityActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.deleteSpace(supabase, venueId, spaceId);
    return { ok: true } as AvailabilityActionResult;
  });
  return result as AvailabilityActionResult;
}

// ---- Capacity Rules ---------------------------------------------------------

export async function getCapacityRules(): Promise<VenueCapacityRules | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return repo.getCapacityRules(await createClient(), venue.id);
}

export async function saveCapacityRules(input: { maxSimultaneousEvents: number; maxSimultaneousTours: number; minTurnaroundHours: number }): Promise<AvailabilityActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.upsertCapacityRules(supabase, venueId, input);
    return { ok: true } as AvailabilityActionResult;
  });
  return result as AvailabilityActionResult;
}

// ---- Date Holds -------------------------------------------------------------

export async function getHolds(opts?: { leadId?: string; activeOnly?: boolean }): Promise<DateHold[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getHolds(await createClient(), venue.id, opts);
}

export async function createHold(input: DateHoldInput): Promise<CreateHoldResult> {
  if (!input.holdDate) return { ok: false, message: "Hold date is required." };
  if (!input.title.trim()) return { ok: false, message: "Title is required." };
  const result = await withVenue(async (supabase, venueId) => {
    const holdId = await repo.insertHold(supabase, venueId, input);
    return { ok: true, holdId } as CreateHoldResult;
  });
  return result as CreateHoldResult;
}

export async function releaseHold(holdId: string): Promise<AvailabilityActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.updateHoldStatus(supabase, venueId, holdId, "released");
    return { ok: true } as AvailabilityActionResult;
  });
  return result as AvailabilityActionResult;
}

export async function convertHold(holdId: string): Promise<AvailabilityActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.updateHoldStatus(supabase, venueId, holdId, "converted");
    return { ok: true } as AvailabilityActionResult;
  });
  return result as AvailabilityActionResult;
}

export async function deleteHold_(holdId: string): Promise<AvailabilityActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.deleteHold(supabase, venueId, holdId);
    return { ok: true } as AvailabilityActionResult;
  });
  return result as AvailabilityActionResult;
}

// ---- Calendar Blocks --------------------------------------------------------

export async function getBlocks(): Promise<CalendarBlock[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getBlocks(await createClient(), venue.id);
}

export async function getBlock(blockId: string): Promise<CalendarBlock | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return repo.getBlock(await createClient(), venue.id, blockId);
}

export async function createBlock(input: CalendarBlockInput): Promise<{ ok: true; blockId: string } | AvailabilityActionResult> {
  if (!input.title.trim()) return { ok: false, message: "Title is required." };
  if (!input.startDate) return { ok: false, message: "Start date is required." };
  const result = await withVenue(async (supabase, venueId) => {
    const blockId = await repo.insertBlock(supabase, venueId, input);
    return { ok: true, blockId };
  });
  return result as { ok: true; blockId: string } | AvailabilityActionResult;
}

export async function deleteBlock_(blockId: string): Promise<AvailabilityActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.deleteBlock(supabase, venueId, blockId);
    return { ok: true } as AvailabilityActionResult;
  });
  return result as AvailabilityActionResult;
}

// "Convert to Booking" — Calendar never creates the Lead itself (that stays
// entirely lib/leads' own business logic, invoked the same way the New
// Inquiry form already does); this only records that a placeholder became
// one, once the Lead already exists.
export async function markBlockConverted_(blockId: string, leadId: string): Promise<AvailabilityActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.markBlockConverted(supabase, venueId, blockId, leadId);
    return { ok: true } as AvailabilityActionResult;
  });
  return result as AvailabilityActionResult;
}

// ---- Conflict detection (public — called from UI) --------------------------

export async function checkAvailability(opts: {
  date: string;
  startTime?: string;
  endTime?: string;
  spaceId?: string;
  type: "event" | "tour";
  excludeId?: string;
}): Promise<AvailabilityStatus> {
  if (!isSupabaseConfigured) return { available: true, conflicts: [] };
  const venue = await getCurrentVenue();
  if (!venue) return { available: true, conflicts: [] };
  return repo.checkAvailability(await createClient(), venue.id, opts);
}
