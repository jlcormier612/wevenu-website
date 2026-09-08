/**
 * Calendar Integration Phase 4 — multi-filtering + saved filters.
 *
 * Client-only, localStorage-persisted filter state (type + assignee +
 * space + manualTypes). Calendar Slice 1: one shared storage key so Month /
 * Week / Day / Agenda keep the same filter selections when switching views.
 */
import * as React from "react";

import type { CalendarItem, CalendarItemType } from "@/lib/calendar/types";
import type { ManualScheduleType } from "@/lib/availability/types";
import { sanitizeVenueCalendarFilters } from "@/lib/calendar/venue-calendar-scope";

export type CalendarFilterState = {
  types: CalendarItemType[] | null; // null = "all types," never persisted as an explicit exclusion list
  staffId: string | null;           // null = "all," "unassigned" = the literal sentinel below
  spaceId: string | null;
  // Narrows within calendar_block items specifically, by their manualType
  // (Consultation, Walkthrough, ...) — never affects any other item type.
  // Only meaningful alongside types including "calendar_block"; a fourth
  // axis on the same shape staffId/spaceId already established, not a
  // second filtering mechanism (Calendar Release Completion — Operational
  // Perspectives).
  manualTypes: ManualScheduleType[] | null;
};

export const UNASSIGNED = "__unassigned__";

/** Shared across Month/Week/Day/Agenda — do not per-view-key this. */
export const CALENDAR_FILTER_STORAGE_KEY = "shared";

const STORAGE_PREFIX = "wevenu-calendar-filters:";

const EMPTY_FILTERS: CalendarFilterState = {
  types: null,
  staffId: null,
  spaceId: null,
  manualTypes: null,
};

function loadSaved(key: string): CalendarFilterState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CalendarFilterState;
    return sanitizeVenueCalendarFilters({
      types: parsed.types ?? null,
      staffId: parsed.staffId ?? null,
      spaceId: parsed.spaceId ?? null,
      manualTypes: parsed.manualTypes ?? null,
    });
  } catch {
    return null;
  }
}

/**
 * @param storageKey Ignored for persistence (always CALENDAR_FILTER_STORAGE_KEY).
 * Kept optional so call sites can stay readable; pass-through values are
 * normalized to the shared key.
 */
export function useCalendarFilters(items: CalendarItem[], _storageKey?: string) {
  const storageKey = CALENDAR_FILTER_STORAGE_KEY;
  const [filters, setFiltersState] = React.useState<CalendarFilterState>(
    () => loadSaved(storageKey) ?? EMPTY_FILTERS,
  );

  const setFilters = React.useCallback((next: CalendarFilterState) => {
    const sanitized = sanitizeVenueCalendarFilters(next);
    setFiltersState(sanitized);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_PREFIX + storageKey, JSON.stringify(sanitized));
    }
  }, [storageKey]);

  const presentTypes = React.useMemo(
    () => [...new Set(items.map((i) => i.type))],
    [items],
  );
  const staffOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const i of items) if (i.assignedToStaffId) map.set(i.assignedToStaffId, i.assignedToName ?? "Unnamed");
    return [...map.entries()];
  }, [items]);
  const spaceOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const i of items) if (i.spaceId) map.set(i.spaceId, i.spaceName ?? "Unnamed space");
    return [...map.entries()];
  }, [items]);

  const filteredItems = React.useMemo(() => items.filter((i) => {
    if (filters.types && !filters.types.includes(i.type)) return false;
    if (filters.staffId) {
      if (filters.staffId === UNASSIGNED) {
        if (i.assignedToStaffId) return false;
      } else if (i.assignedToStaffId !== filters.staffId) return false;
    }
    if (filters.spaceId) {
      if (filters.spaceId === UNASSIGNED) {
        if (i.spaceId) return false;
      } else if (i.spaceId !== filters.spaceId) return false;
    }
    // Only narrows calendar_block items — every other type has no
    // manualType of its own and is unaffected, exactly like staffId/spaceId
    // narrow only the items that carry them.
    if (filters.manualTypes && i.type === "calendar_block") {
      if (!i.manualType || !filters.manualTypes.includes(i.manualType)) return false;
    }
    return true;
  }), [items, filters]);

  return { filters, setFilters, filteredItems, presentTypes, staffOptions, spaceOptions };
}
