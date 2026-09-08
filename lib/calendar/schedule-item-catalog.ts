/**
 * Calendar Slice 2A.1 — venue appointment catalog (configuration only).
 *
 * Scheduled instances remain in calendar_blocks. This module resolves which
 * catalog offering a create/update may use and what occupancy snapshot to
 * write onto the block row.
 */
import type { ManualScheduleType } from "@/lib/availability/types";
import { isBookingPlaceholder, MANUAL_SCHEDULE_TYPES } from "@/lib/availability/types";

export const APPOINTMENT_CATALOG_BUILTIN_KEYS = [
  "consultation",
  "client_meeting",
  "walkthrough",
  "vendor_meeting",
  "personal_appointment",
  "blocked_time",
  "other",
  "tasting",
] as const;

export type AppointmentCatalogBuiltinKey = (typeof APPOINTMENT_CATALOG_BUILTIN_KEYS)[number];

/** Settings UI groups — display order for 2A.2.1 (not DB group_key alone). */
export const SCHEDULE_APPOINTMENT_SETTINGS_GROUPS: {
  label: string;
  keys: AppointmentCatalogBuiltinKey[];
}[] = [
  {
    label: "Appointments",
    keys: ["consultation", "client_meeting", "walkthrough", "vendor_meeting", "tasting"],
  },
  {
    label: "Blocked & personal time",
    keys: ["personal_appointment", "blocked_time", "other"],
  },
];

export const APPOINTMENT_CATALOG_MAX_ACTIVE_CUSTOMS = 20;

/** UI Kind for custom types — maps to catalog group_key. */
export type CustomScheduleItemKind = "appointment" | "reserved_blocked";

export const CUSTOM_SCHEDULE_ITEM_KIND_OPTIONS: {
  value: CustomScheduleItemKind;
  label: string;
}[] = [
  { value: "appointment", label: "Appointment" },
  { value: "reserved_blocked", label: "Blocked & personal time" },
];

export function customKindToGroupKey(kind: CustomScheduleItemKind): ScheduleItemGroupKey {
  return kind === "appointment" ? "meetings" : "availability";
}

export function groupKeyToCustomKind(groupKey: ScheduleItemGroupKey): CustomScheduleItemKind {
  return groupKey === "meetings" ? "appointment" : "reserved_blocked";
}

export function normalizeCatalogLabel(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function catalogLabelsEqual(a: string, b: string): boolean {
  return normalizeCatalogLabel(a).toLocaleLowerCase() === normalizeCatalogLabel(b).toLocaleLowerCase();
}

/** Stable server-side custom_key — never shown or edited in the UI. */
export function generateCustomKey(label: string): string {
  const base = normalizeCatalogLabel(label)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return base || "custom";
}

export function countActiveCustomTypes(catalog: VenueScheduleItemType[]): number {
  return catalog.filter((r) => r.source === "custom" && !r.archivedAt).length;
}

/**
 * Pure name validation for create / rename / restore.
 * Does not mutate calendar_blocks.
 */
export function validateCustomScheduleItemTypeLabel(input: {
  label: string;
  catalog: VenueScheduleItemType[];
  /** When renaming/restoring, exclude this custom row from duplicate checks. */
  excludeId?: string | null;
}): { ok: true; label: string } | { ok: false; message: string } {
  const label = normalizeCatalogLabel(input.label);
  if (!label) {
    return { ok: false, message: "Enter a name for this appointment type." };
  }
  for (const row of input.catalog) {
    if (input.excludeId && row.id === input.excludeId) continue;
    if (!catalogLabelsEqual(row.label, label)) continue;
    if (row.source === "builtin") {
      return {
        ok: false,
        message: `“${label}” is already a built-in type. Choose a different name.`,
      };
    }
    if (row.source === "custom" && !row.archivedAt) {
      return {
        ok: false,
        message: `You already have an active type named “${row.label}”. Choose a different name.`,
      };
    }
  }
  return { ok: true, label };
}

export function validateActiveCustomCap(
  catalog: VenueScheduleItemType[],
  opts?: { excludeId?: string | null },
): { ok: true } | { ok: false; message: string } {
  const active = catalog.filter(
    (r) =>
      r.source === "custom"
      && !r.archivedAt
      && (!opts?.excludeId || r.id !== opts.excludeId),
  ).length;
  if (active >= APPOINTMENT_CATALOG_MAX_ACTIVE_CUSTOMS) {
    return {
      ok: false,
      message: `You can have up to ${APPOINTMENT_CATALOG_MAX_ACTIVE_CUSTOMS} custom types. Archive one before adding or restoring another.`,
    };
  }
  return { ok: true };
}

export type ScheduleItemTypeSource = "builtin" | "custom";
export type ScheduleItemGroupKey = "meetings" | "availability" | "other";

export type VenueScheduleItemType = {
  id: string;
  venueId: string;
  source: ScheduleItemTypeSource;
  builtinKey: AppointmentCatalogBuiltinKey | null;
  customKey: string | null;
  label: string;
  enabled: boolean;
  blocksAvailability: boolean;
  groupKey: ScheduleItemGroupKey;
  sortOrder: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ScheduleItemTypeRow = {
  id: string;
  venue_id: string;
  source: ScheduleItemTypeSource;
  builtin_key: string | null;
  custom_key: string | null;
  label: string;
  enabled: boolean;
  blocks_availability: boolean;
  group_key: ScheduleItemGroupKey;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export function mapScheduleItemTypeRow(row: ScheduleItemTypeRow): VenueScheduleItemType {
  return {
    id: row.id,
    venueId: row.venue_id,
    source: row.source,
    builtinKey: (row.builtin_key as AppointmentCatalogBuiltinKey | null) ?? null,
    customKey: row.custom_key,
    label: row.label,
    enabled: row.enabled,
    blocksAvailability: row.blocks_availability,
    groupKey: row.group_key,
    sortOrder: row.sort_order,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function isAppointmentCatalogBuiltinKey(value: string): value is AppointmentCatalogBuiltinKey {
  return (APPOINTMENT_CATALOG_BUILTIN_KEYS as readonly string[]).includes(value);
}

/** System roles that never appear as appointment-catalog rows. */
export function isNonCatalogManualScheduleType(type: ManualScheduleType): boolean {
  return type === "tour"
    || type === "wedding_event_booking"
    || type === "private_event";
}

export type ResolvedScheduleCatalogWrite = {
  type: ManualScheduleType;
  scheduleItemTypeId: string | null;
  blocksAvailability: boolean;
  catalogLabel: string | null;
};

export type CatalogResolveError = { ok: false; message: string };
export type CatalogResolveOk = { ok: true; resolved: ResolvedScheduleCatalogWrite };

/**
 * Pure decision for what to write given an already-fetched catalog row
 * (or null for system placeholders / legacy preserve).
 */
export function resolveScheduleCatalogWrite(input: {
  type: ManualScheduleType;
  catalog: VenueScheduleItemType | null;
  /** When editing and keeping a legacy-only type, pass the existing snapshot. */
  preserveExisting?: { scheduleItemTypeId: string | null; blocksAvailability: boolean } | null;
  scheduleItemTypeId?: string | null;
}): CatalogResolveOk | CatalogResolveError {
  const { type, catalog, preserveExisting } = input;

  if (isBookingPlaceholder(type)) {
    return {
      ok: true,
      resolved: {
        type,
        scheduleItemTypeId: null,
        blocksAvailability: true,
        catalogLabel: null,
      },
    };
  }

  if (type === "tour") {
    if (preserveExisting) {
      return {
        ok: true,
        resolved: {
          type,
          scheduleItemTypeId: preserveExisting.scheduleItemTypeId,
          blocksAvailability: preserveExisting.blocksAvailability,
          catalogLabel: null,
        },
      };
    }
    return { ok: false, message: "That schedule item type can’t be created. Book tours from Tours." };
  }

  if (type === "custom") {
    if (!catalog || catalog.source !== "custom") {
      return { ok: false, message: "Choose a valid custom schedule item type." };
    }
    if (catalog.venueId && input.scheduleItemTypeId && catalog.id !== input.scheduleItemTypeId) {
      return { ok: false, message: "Choose a valid custom schedule item type." };
    }
    if (!catalog.enabled || catalog.archivedAt) {
      // Existing rows may keep a now-disabled custom; new selection cannot.
      if (!preserveExisting) {
        return { ok: false, message: "That schedule item type isn’t available." };
      }
      return {
        ok: true,
        resolved: {
          type: "custom",
          scheduleItemTypeId: preserveExisting.scheduleItemTypeId ?? catalog.id,
          blocksAvailability: preserveExisting.blocksAvailability,
          catalogLabel: catalog.label,
        },
      };
    }
    if (preserveExisting) {
      // Same-type edit: keep the stored occupancy snapshot.
      return {
        ok: true,
        resolved: {
          type: "custom",
          scheduleItemTypeId: preserveExisting.scheduleItemTypeId ?? catalog.id,
          blocksAvailability: preserveExisting.blocksAvailability,
          catalogLabel: catalog.label,
        },
      };
    }
    return {
      ok: true,
      resolved: {
        type: "custom",
        scheduleItemTypeId: catalog.id,
        blocksAvailability: catalog.blocksAvailability,
        catalogLabel: catalog.label,
      },
    };
  }

  if (isAppointmentCatalogBuiltinKey(type)) {
    if (!catalog || catalog.source !== "builtin" || catalog.builtinKey !== type) {
      return { ok: false, message: "That schedule item type isn’t available for this venue." };
    }
    if (!catalog.enabled || catalog.archivedAt) {
      // Existing rows may keep a now-disabled type; new selection cannot.
      if (!preserveExisting) {
        return { ok: false, message: "That schedule item type isn’t available." };
      }
      return {
        ok: true,
        resolved: {
          type,
          scheduleItemTypeId: preserveExisting.scheduleItemTypeId ?? catalog.id,
          blocksAvailability: preserveExisting.blocksAvailability,
          catalogLabel: catalog.label,
        },
      };
    }
    if (preserveExisting) {
      // Same-type edit: keep the stored occupancy snapshot (catalog policy
      // applies to future creates / type changes only).
      return {
        ok: true,
        resolved: {
          type,
          scheduleItemTypeId: preserveExisting.scheduleItemTypeId ?? catalog.id,
          blocksAvailability: preserveExisting.blocksAvailability,
          catalogLabel: catalog.label,
        },
      };
    }
    return {
      ok: true,
      resolved: {
        type,
        scheduleItemTypeId: catalog.id,
        blocksAvailability: catalog.blocksAvailability,
        catalogLabel: catalog.label,
      },
    };
  }

  return { ok: false, message: "That schedule item type can’t be used." };
}

/** Picker option for Add/Edit Schedule Item (Calendar 2A.2.2). */
export type ScheduleItemPickerOption = {
  /** Select value — builtin/placeholder key, or `custom:<catalogId>`. */
  value: string;
  type: ManualScheduleType;
  scheduleItemTypeId: string | null;
  label: string;
  /** Dot color key — same ManualScheduleType used for MANUAL_TYPE_META. */
  metaType: ManualScheduleType;
};

export type ScheduleItemPickerGroup = {
  label: string;
  options: ScheduleItemPickerOption[];
};

const RESERVED_DATE_OPTIONS: ScheduleItemPickerOption[] = [
  {
    value: "wedding_event_booking",
    type: "wedding_event_booking",
    scheduleItemTypeId: null,
    label: "Wedding / Event Booking",
    metaType: "wedding_event_booking",
  },
  {
    value: "private_event",
    type: "private_event",
    scheduleItemTypeId: null,
    label: "Private Event",
    metaType: "private_event",
  },
];

export function scheduleItemPickerValue(option: {
  type: ManualScheduleType;
  scheduleItemTypeId?: string | null;
}): string {
  if (option.type === "custom" && option.scheduleItemTypeId) {
    return `custom:${option.scheduleItemTypeId}`;
  }
  return option.type;
}

export function parseScheduleItemPickerValue(value: string): {
  type: ManualScheduleType;
  scheduleItemTypeId: string | null;
} | null {
  if (value.startsWith("custom:")) {
    const id = value.slice("custom:".length);
    if (!id) return null;
    return { type: "custom", scheduleItemTypeId: id };
  }
  if (
    (MANUAL_SCHEDULE_TYPES as readonly string[]).includes(value)
    && value !== "custom"
  ) {
    return { type: value as ManualScheduleType, scheduleItemTypeId: null };
  }
  return null;
}

/**
 * Build create-form picker groups from enabled catalog rows + reserved-date
 * system placeholders. Tour is never offered. Disabled catalog rows omitted.
 */
export function buildScheduleItemPickerGroups(
  catalog: VenueScheduleItemType[],
): ScheduleItemPickerGroup[] {
  const enabled = catalog.filter((r) => r.enabled && !r.archivedAt);
  const appointments: ScheduleItemPickerOption[] = [];
  const reservedBlocked: ScheduleItemPickerOption[] = [];

  for (const row of enabled) {
    if (row.source === "builtin" && row.builtinKey) {
      const option: ScheduleItemPickerOption = {
        value: row.builtinKey,
        type: row.builtinKey,
        scheduleItemTypeId: row.id,
        label: row.label,
        metaType: row.builtinKey,
      };
      if (row.groupKey === "meetings") appointments.push(option);
      else reservedBlocked.push(option);
      continue;
    }
    if (row.source === "custom") {
      const option: ScheduleItemPickerOption = {
        value: scheduleItemPickerValue({ type: "custom", scheduleItemTypeId: row.id }),
        type: "custom",
        scheduleItemTypeId: row.id,
        label: row.label,
        metaType: "custom",
      };
      if (row.groupKey === "meetings") appointments.push(option);
      else reservedBlocked.push(option);
    }
  }

  const sortOpts = (a: ScheduleItemPickerOption, b: ScheduleItemPickerOption) =>
    a.label.localeCompare(b.label);

  appointments.sort(sortOpts);
  reservedBlocked.sort(sortOpts);

  const groups: ScheduleItemPickerGroup[] = [];
  if (appointments.length > 0) {
    groups.push({ label: "Appointments", options: appointments });
  }
  if (reservedBlocked.length > 0) {
    groups.push({ label: "Blocked & personal time", options: reservedBlocked });
  }
  groups.push({ label: "Holds", options: RESERVED_DATE_OPTIONS });
  return groups;
}

/** Flat enabled options for membership checks (create form). */
export function flattenScheduleItemPickerOptions(
  groups: ScheduleItemPickerGroup[],
): ScheduleItemPickerOption[] {
  return groups.flatMap((g) => g.options);
}
