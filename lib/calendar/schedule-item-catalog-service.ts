/**
 * Calendar Slice 2A.2.1 / 2A.2.3 — venue schedule appointment catalog settings (server).
 */
import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import {
  APPOINTMENT_CATALOG_MAX_ACTIVE_CUSTOMS,
  customKindToGroupKey,
  generateCustomKey,
  isAppointmentCatalogBuiltinKey,
  validateActiveCustomCap,
  validateCustomScheduleItemTypeLabel,
  type AppointmentCatalogBuiltinKey,
  type CustomScheduleItemKind,
  type VenueScheduleItemType,
} from "@/lib/calendar/schedule-item-catalog";
import {
  archiveCustomScheduleItemTypeRow,
  insertCustomScheduleItemTypeRow,
  listVenueScheduleItemTypes,
  restoreCustomScheduleItemTypeRow,
  seedVenueScheduleItemTypes,
  updateBuiltinScheduleItemTypeRow,
  updateCustomScheduleItemTypeRow,
} from "@/lib/calendar/schedule-item-catalog-repository";
import { getCurrentUserRole, getCurrentVenue } from "@/lib/venue/service";

export type CatalogSettingsActionResult = { ok: true } | { ok: false; message: string };

export type CatalogSettingsGuardResult =
  | { ok: true; key: AppointmentCatalogBuiltinKey }
  | { ok: false; message: string };

function canManageCatalog(role: string | null): boolean {
  return role === "owner" || role === "manager";
}

function requireManageCatalog(role: string | null): CatalogSettingsActionResult | null {
  if (!canManageCatalog(role)) {
    return { ok: false, message: "Only an owner or manager can change scheduled appointment types." };
  }
  return null;
}

function mapCatalogWriteError(err: unknown): string {
  const message = err instanceof Error ? err.message : "Could not save.";
  if (/at most 20 active custom/i.test(message)) {
    return `You can have up to ${APPOINTMENT_CATALOG_MAX_ACTIVE_CUSTOMS} custom types. Archive one before adding or restoring another.`;
  }
  if (/active_label_uidx|duplicate key|unique/i.test(message)) {
    return "That name is already in use. Choose a different name.";
  }
  if (/blocked_time/i.test(message) || (/check/i.test(message) && /blocked/i.test(message))) {
    return "Blocked Time can’t be turned off.";
  }
  return message;
}

/**
 * Pure authorization + catalog rules for builtin Settings mutations.
 * Used before any DB write; does not touch calendar_blocks.
 */
export function guardBuiltinScheduleItemTypeSettingsChange(input: {
  role: string | null;
  builtinKey: string;
  enabled?: boolean;
  blocksAvailability?: boolean;
}): CatalogSettingsGuardResult {
  if (!canManageCatalog(input.role)) {
    return { ok: false, message: "Only an owner or manager can change scheduled appointment types." };
  }
  if (!isAppointmentCatalogBuiltinKey(input.builtinKey)) {
    return { ok: false, message: "That appointment type isn’t available." };
  }
  const key = input.builtinKey;
  if (key === "blocked_time") {
    if (input.enabled === false) {
      return { ok: false, message: "Blocked Time can’t be turned off." };
    }
    if (input.blocksAvailability === false) {
      return { ok: false, message: "Blocked Time always reserves venue time for events." };
    }
  }
  return { ok: true, key };
}

async function loadVenueCatalogRows(venueId: string): Promise<VenueScheduleItemType[]> {
  const supabase = await createClient();
  let rows = await listVenueScheduleItemTypes(supabase, venueId);
  const builtins = rows.filter((r) => r.source === "builtin");
  if (builtins.length < 8) {
    await seedVenueScheduleItemTypes(createAdminClient(), venueId);
    rows = await listVenueScheduleItemTypes(supabase, venueId);
  }
  return rows;
}

/** Built-ins + customs (including archived) for Settings display. */
export async function getScheduleItemTypesForSettings(): Promise<VenueScheduleItemType[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return (await loadVenueCatalogRows(venue.id))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
}

/** Built-in rows only — Settings callers that only need builtins. */
export async function getBuiltinScheduleItemTypesForSettings(): Promise<VenueScheduleItemType[]> {
  return (await getScheduleItemTypesForSettings()).filter((r) => r.source === "builtin" && r.builtinKey);
}

/**
 * Catalog rows for Calendar Schedule Item create/edit.
 * Includes disabled/archived so edit can show a current type that is no
 * longer offered for create. Picker UI filters to enabled + non-archived.
 */
export async function getScheduleItemTypesForPicker(): Promise<VenueScheduleItemType[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return (await loadVenueCatalogRows(venue.id))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
}

/**
 * Update enabled and/or blocks_availability for one builtin catalog row.
 * Does not rewrite existing calendar_blocks snapshots.
 */
export async function updateBuiltinScheduleItemTypeSettings(input: {
  builtinKey: string;
  enabled?: boolean;
  blocksAvailability?: boolean;
}): Promise<CatalogSettingsActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const role = await getCurrentUserRole();
  const guarded = guardBuiltinScheduleItemTypeSettingsChange({
    role,
    builtinKey: input.builtinKey,
    enabled: input.enabled,
    blocksAvailability: input.blocksAvailability,
  });
  if (!guarded.ok) return guarded;
  if (input.enabled === undefined && input.blocksAvailability === undefined) {
    return { ok: true };
  }

  const supabase = await createClient();
  try {
    await updateBuiltinScheduleItemTypeRow(supabase, venue.id, guarded.key, {
      enabled: input.enabled,
      blocksAvailability: input.blocksAvailability,
    });
  } catch (err) {
    return { ok: false, message: mapCatalogWriteError(err) };
  }
  return { ok: true };
}

function nextCustomSortOrder(catalog: VenueScheduleItemType[], groupKey: string): number {
  const inGroup = catalog.filter((r) => r.source === "custom" && r.groupKey === groupKey);
  const max = inGroup.reduce((m, r) => Math.max(m, r.sortOrder), 100);
  return max + 10;
}

function uniqueCustomKey(base: string, catalog: VenueScheduleItemType[]): string {
  const taken = new Set(
    catalog
      .filter((r) => r.source === "custom" && !r.archivedAt && r.customKey)
      .map((r) => r.customKey as string),
  );
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base.slice(0, 40)}_${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}_${Date.now().toString(36)}`;
}

/** Create a custom appointment / reserved type. Does not touch calendar_blocks. */
export async function createCustomScheduleItemType(input: {
  label: string;
  kind: CustomScheduleItemKind;
  blocksAvailability?: boolean;
}): Promise<CatalogSettingsActionResult & { id?: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const role = await getCurrentUserRole();
  const denied = requireManageCatalog(role);
  if (denied) return denied;
  if (input.kind !== "appointment" && input.kind !== "reserved_blocked") {
    return { ok: false, message: "Choose whether this is an Appointment or Reserved & blocked time." };
  }

  const catalog = await loadVenueCatalogRows(venue.id);
  const cap = validateActiveCustomCap(catalog);
  if (!cap.ok) return cap;
  const named = validateCustomScheduleItemTypeLabel({ label: input.label, catalog });
  if (!named.ok) return named;

  const groupKey = customKindToGroupKey(input.kind);
  const customKey = uniqueCustomKey(generateCustomKey(named.label), catalog);
  const supabase = await createClient();
  try {
    const row = await insertCustomScheduleItemTypeRow(supabase, venue.id, {
      customKey,
      label: named.label,
      blocksAvailability: input.blocksAvailability !== false,
      groupKey,
      sortOrder: nextCustomSortOrder(catalog, groupKey),
    });
    return { ok: true, id: row.id };
  } catch (err) {
    return { ok: false, message: mapCatalogWriteError(err) };
  }
}

/** Rename and/or change reserve setting. Never rewrites calendar_blocks. */
export async function updateCustomScheduleItemType(input: {
  id: string;
  label?: string;
  blocksAvailability?: boolean;
}): Promise<CatalogSettingsActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const role = await getCurrentUserRole();
  const denied = requireManageCatalog(role);
  if (denied) return denied;
  if (!input.id) return { ok: false, message: "Custom appointment type not found." };

  const catalog = await loadVenueCatalogRows(venue.id);
  const existing = catalog.find((r) => r.id === input.id && r.source === "custom");
  if (!existing) return { ok: false, message: "Custom appointment type not found." };
  if (existing.archivedAt) {
    return { ok: false, message: "Restore this type before changing it." };
  }

  let label = existing.label;
  if (input.label !== undefined) {
    const named = validateCustomScheduleItemTypeLabel({
      label: input.label,
      catalog,
      excludeId: existing.id,
    });
    if (!named.ok) return named;
    label = named.label;
  }

  if (input.label === undefined && input.blocksAvailability === undefined) {
    return { ok: true };
  }

  const supabase = await createClient();
  try {
    await updateCustomScheduleItemTypeRow(supabase, venue.id, existing.id, {
      label: input.label !== undefined ? label : undefined,
      blocksAvailability: input.blocksAvailability,
    });
  } catch (err) {
    return { ok: false, message: mapCatalogWriteError(err) };
  }
  return { ok: true };
}

export async function archiveCustomScheduleItemType(input: {
  id: string;
}): Promise<CatalogSettingsActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const role = await getCurrentUserRole();
  const denied = requireManageCatalog(role);
  if (denied) return denied;

  const catalog = await loadVenueCatalogRows(venue.id);
  const existing = catalog.find((r) => r.id === input.id && r.source === "custom");
  if (!existing) return { ok: false, message: "Custom appointment type not found." };
  if (existing.archivedAt) return { ok: true };

  const supabase = await createClient();
  try {
    await archiveCustomScheduleItemTypeRow(supabase, venue.id, existing.id);
  } catch (err) {
    return { ok: false, message: mapCatalogWriteError(err) };
  }
  return { ok: true };
}

export async function restoreCustomScheduleItemType(input: {
  id: string;
}): Promise<CatalogSettingsActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const role = await getCurrentUserRole();
  const denied = requireManageCatalog(role);
  if (denied) return denied;

  const catalog = await loadVenueCatalogRows(venue.id);
  const existing = catalog.find((r) => r.id === input.id && r.source === "custom");
  if (!existing) return { ok: false, message: "Custom appointment type not found." };
  if (!existing.archivedAt) return { ok: true };

  const cap = validateActiveCustomCap(catalog);
  if (!cap.ok) return cap;
  const named = validateCustomScheduleItemTypeLabel({
    label: existing.label,
    catalog,
    excludeId: existing.id,
  });
  if (!named.ok) return named;

  const supabase = await createClient();
  try {
    await restoreCustomScheduleItemTypeRow(supabase, venue.id, existing.id);
  } catch (err) {
    return { ok: false, message: mapCatalogWriteError(err) };
  }
  return { ok: true };
}
