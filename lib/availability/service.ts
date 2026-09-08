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
import { validateScheduleItemTimes } from "@/lib/calendar/schedule-item-times";
import { isLegacyOnlyManualScheduleType } from "@/lib/calendar/venue-calendar-scope";
import {
  isAppointmentCatalogBuiltinKey,
  resolveScheduleCatalogWrite,
} from "@/lib/calendar/schedule-item-catalog";
import {
  getBuiltinScheduleItemType,
  getScheduleItemTypeById,
} from "@/lib/calendar/schedule-item-catalog-repository";
import { isBookingPlaceholder } from "@/lib/availability/types";

function isCatalogOrSystemWritableType(type: import("@/lib/availability/types").ManualScheduleType): boolean {
  return isBookingPlaceholder(type)
    || type === "custom"
    || isAppointmentCatalogBuiltinKey(type);
}

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
  if (input.type === "tour") {
    return { ok: false, message: "That schedule item type can’t be created. Book tours from Tours." };
  }
  if (input.type === "custom") {
    if (!input.scheduleItemTypeId) {
      return { ok: false, message: "Choose a valid custom schedule item type." };
    }
  } else if (!isCatalogOrSystemWritableType(input.type)) {
    return { ok: false, message: "That schedule item type can’t be created. Book tours from Tours." };
  }
  const timeError = validateScheduleItemTimes(input);
  if (timeError) return timeError;
  const result = await withVenue(async (supabase, venueId) => {
    const catalog = input.type === "custom"
      ? await getScheduleItemTypeById(supabase, venueId, input.scheduleItemTypeId!)
      : isAppointmentCatalogBuiltinKey(input.type)
        ? await getBuiltinScheduleItemType(supabase, venueId, input.type)
        : null;
    const resolved = resolveScheduleCatalogWrite({
      type: input.type,
      catalog,
      scheduleItemTypeId: input.scheduleItemTypeId,
    });
    if (!resolved.ok) return resolved;
    const blockId = await repo.insertBlock(supabase, venueId, {
      ...input,
      type: resolved.resolved.type,
      scheduleItemTypeId: resolved.resolved.scheduleItemTypeId,
      blocksAvailability: resolved.resolved.blocksAvailability,
    });
    return { ok: true, blockId };
  });
  return result as { ok: true; blockId: string } | AvailabilityActionResult;
}

export async function updateBlock_(blockId: string, input: CalendarBlockInput): Promise<AvailabilityActionResult> {
  if (!input.title.trim()) return { ok: false, message: "Title is required." };
  if (!input.startDate) return { ok: false, message: "Start date is required." };
  const timeError = validateScheduleItemTimes(input);
  if (timeError) return timeError;
  const result = await withVenue(async (supabase, venueId) => {
    const existing = await repo.getBlock(supabase, venueId, blockId);
    if (!existing) return { ok: false, message: "Schedule item not found." } as AvailabilityActionResult;

    const preservingLegacy =
      isLegacyOnlyManualScheduleType(input.type) && existing.type === input.type;
    const preservingSameType = existing.type === input.type
      && (
        input.type !== "custom"
        || (input.scheduleItemTypeId ?? existing.scheduleItemTypeId) === existing.scheduleItemTypeId
      );

    if (!preservingLegacy) {
      if (input.type === "custom" && !(input.scheduleItemTypeId || existing.scheduleItemTypeId)) {
        return { ok: false, message: "Choose a valid custom schedule item type." } as AvailabilityActionResult;
      }
      if (
        input.type !== "custom"
        && !isCatalogOrSystemWritableType(input.type)
        && !preservingSameType
      ) {
        return { ok: false, message: "That schedule item type can’t be used for new or changed items." } as AvailabilityActionResult;
      }
    }

    const catalogTypeId = input.scheduleItemTypeId || existing.scheduleItemTypeId;
    const catalog = preservingLegacy
      ? null
      : input.type === "custom"
        ? (catalogTypeId ? await getScheduleItemTypeById(supabase, venueId, catalogTypeId) : null)
        : isAppointmentCatalogBuiltinKey(input.type)
          ? await getBuiltinScheduleItemType(supabase, venueId, input.type)
          : null;

    const resolved = resolveScheduleCatalogWrite({
      type: input.type,
      catalog,
      scheduleItemTypeId: catalogTypeId,
      preserveExisting: preservingLegacy || preservingSameType
        ? {
          scheduleItemTypeId: existing.scheduleItemTypeId,
          blocksAvailability: existing.blocksAvailability,
        }
        : null,
    });
    if (!resolved.ok) return resolved;

    await repo.updateBlock(supabase, venueId, blockId, {
      ...input,
      type: resolved.resolved.type,
      scheduleItemTypeId: resolved.resolved.scheduleItemTypeId,
      blocksAvailability: resolved.resolved.blocksAvailability,
    });
    return { ok: true } as AvailabilityActionResult;
  });
  return result as AvailabilityActionResult;
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
  endDate?: string;
  startTime?: string;
  endTime?: string;
  setupTime?: string;
  teardownTime?: string;
  spaceId?: string;
  type: "event" | "tour";
  excludeId?: string;
}): Promise<AvailabilityStatus> {
  if (!isSupabaseConfigured) return { available: true, conflicts: [] };
  const venue = await getCurrentVenue();
  if (!venue) return { available: true, conflicts: [] };
  return repo.checkAvailability(await createClient(), venue.id, {
    ...opts,
    timezone: venue.timezone,
  });
}
