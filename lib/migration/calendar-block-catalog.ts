/**
 * Migration Center — calendar_block catalog resolve for import commits.
 *
 * Does not invent catalog types. Custom imports must point at an existing
 * venue-scoped catalog row. Builtins/placeholders/legacy tour keep their
 * supported shapes without inventing rows.
 */
import {
  isAppointmentCatalogBuiltinKey,
  type VenueScheduleItemType,
} from "@/lib/calendar/schedule-item-catalog";
import {
  isBookingPlaceholder,
  type ManualScheduleType,
} from "@/lib/availability/types";
import { MANUAL_SCHEDULE_TYPES } from "@/lib/availability/types";

export type MigrationCalendarBlockCatalogResolved = {
  type: ManualScheduleType;
  scheduleItemTypeId: string | null;
  blocksAvailability: boolean;
};

export type MigrationCalendarBlockCatalogInput = {
  type: string;
  /** Preferred for custom rows — must be a custom catalog id for this venue. */
  scheduleItemTypeId?: string | null;
  /** Alternate custom lookup when id is not provided. */
  customKey?: string | null;
  catalogById: VenueScheduleItemType | null;
  catalogByCustomKey: VenueScheduleItemType | null;
  catalogByBuiltinKey: VenueScheduleItemType | null;
};

function isManualScheduleType(value: string): value is ManualScheduleType {
  return (MANUAL_SCHEDULE_TYPES as readonly string[]).includes(value);
}

/**
 * Pure resolve for imported calendar_blocks. Callers look up catalog rows
 * for the session venue before invoking this.
 */
export function resolveMigrationCalendarBlockCatalog(
  input: MigrationCalendarBlockCatalogInput,
): { ok: true; resolved: MigrationCalendarBlockCatalogResolved } | { ok: false; error: string } {
  const typeRaw = String(input.type ?? "").trim();
  if (!isManualScheduleType(typeRaw)) {
    return {
      ok: false,
      error: `Unrecognized schedule type "${typeRaw}". Use one of HTC's supported calendar types.`,
    };
  }

  if (isBookingPlaceholder(typeRaw)) {
    return {
      ok: true,
      resolved: {
        type: typeRaw,
        scheduleItemTypeId: null,
        blocksAvailability: true,
      },
    };
  }

  if (typeRaw === "tour") {
    // Legacy manual tour rows remain importable; not catalog-backed.
    return {
      ok: true,
      resolved: {
        type: "tour",
        scheduleItemTypeId: null,
        blocksAvailability: true,
      },
    };
  }

  if (typeRaw === "custom") {
    const byId = input.catalogById;
    const byKey = input.catalogByCustomKey;
    const catalog = byId ?? byKey;
    if (!input.scheduleItemTypeId && !input.customKey) {
      return {
        ok: false,
        error:
          "Custom schedule items need an existing appointment type for this venue (catalog id or custom key). HTC will not invent a new type during import.",
      };
    }
    if (!catalog || catalog.source !== "custom") {
      return {
        ok: false,
        error: "That custom appointment type isn’t available for this venue.",
      };
    }
    if (input.scheduleItemTypeId && catalog.id !== input.scheduleItemTypeId) {
      return {
        ok: false,
        error: "That custom appointment type isn’t available for this venue.",
      };
    }
    if (input.customKey && catalog.customKey !== input.customKey) {
      return {
        ok: false,
        error: "That custom appointment type isn’t available for this venue.",
      };
    }
    if (catalog.archivedAt) {
      return {
        ok: false,
        error: "That custom appointment type isn’t available for this venue.",
      };
    }
    return {
      ok: true,
      resolved: {
        type: "custom",
        scheduleItemTypeId: catalog.id,
        blocksAvailability: catalog.blocksAvailability,
      },
    };
  }

  if (isAppointmentCatalogBuiltinKey(typeRaw)) {
    const catalog = input.catalogByBuiltinKey;
    if (!catalog || catalog.source !== "builtin" || catalog.builtinKey !== typeRaw) {
      return {
        ok: false,
        error: "That appointment type isn’t set up for this venue yet.",
      };
    }
    // Import may attach builtins even when currently disabled (e.g. tasting)
    // so historical rows keep a venue-scoped catalog FK + snapshot.
    return {
      ok: true,
      resolved: {
        type: typeRaw,
        scheduleItemTypeId: catalog.id,
        blocksAvailability: catalog.blocksAvailability,
      },
    };
  }

  return {
    ok: false,
    error: `Unrecognized schedule type "${typeRaw}". Use one of HTC's supported calendar types.`,
  };
}
