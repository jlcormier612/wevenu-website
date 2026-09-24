"use client";

/**
 * Shared building blocks for every Calendar surface (Month grid, Week/Day/
 * Agenda views) — kept in their own file so those views can import them
 * without creating a circular dependency on calendar-view.tsx, which itself
 * renders the Week/Day/Agenda views.
 */
import * as React from "react";

import Link from "next/link";
import {
  Ban, CalendarClock, CalendarDays, Clock, ClipboardList, DollarSign,
  FileClock, FileSignature, Footprints, GanttChart, Handshake, ListTodo, MapPin,
  MoreHorizontal, Pencil, Phone, Trash2, User, Users, Utensils,
} from "lucide-react";

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { CalendarItem, CalendarItemType } from "@/lib/calendar/types";
import { CALENDAR_MAX_YEAR, CALENDAR_MIN_YEAR } from "@/lib/calendar/types";
import { isBookingPlaceholder } from "@/lib/availability/types";
import type { ManualScheduleType } from "@/lib/availability/types";
import {
  filtersFromTaxonomySelection,
  presentVenueCalendarTaxonomyKeys,
  taxonomySelectionFromFilters,
  venueCalendarTaxonomyLabel,
  type VenueCalendarTaxonomyKey,
  VENUE_CALENDAR_TAXONOMY,
} from "@/lib/calendar/venue-calendar-scope";
import { cn } from "@/lib/utils";

type ItemMeta = {
  label: string;
  icon: React.ElementType;
  dotColor: string;  // CSS var reference, e.g. "var(--cal-event)"
  textClass: string;
};

// dotColor uses CSS custom properties (defined in globals.css) so dark-mode
// overrides in .dark { } work automatically — no JS dark-mode detection needed.
export const TYPE_META: Record<CalendarItemType, ItemMeta> = {
  event:          { label: "Event",       icon: CalendarDays,  dotColor: "var(--cal-event)",       textClass: "text-primary" },
  // Tour uses the platform clear blue (--cal-tour → same token family as the
  // former walkthrough blue), not soft-sage green.
  tour:           { label: "Tour",        icon: MapPin,        dotColor: "var(--cal-tour)",        textClass: "text-heading" },
  follow_up:      { label: "Follow-up",   icon: Phone,         dotColor: "var(--cal-follow-up)",   textClass: "text-muted-foreground" },
  payment_due:    { label: "Payment Due", icon: DollarSign,    dotColor: "var(--cal-payment-due)", textClass: "text-destructive" },
  // One human-facing Hold concept — backend may still use date_holds table.
  date_hold:      { label: "Hold",        icon: Clock,         dotColor: "var(--cal-date-hold)",   textClass: "text-heading" },
  // Blocked Time = intentionally unavailable — destructive/error red.
  calendar_block: { label: "Blocked Time", icon: Ban,           dotColor: "var(--cal-blocked)",     textClass: "text-destructive" },
  planning_activity: { label: "Planning", icon: CalendarClock, dotColor: "var(--cal-planning-activity)", textClass: "text-heading" },
  request_due:          { label: "Request",           icon: ClipboardList, dotColor: "var(--cal-request-due)",          textClass: "text-heading" },
  contract_expiration:  { label: "Contract Expires",  icon: FileSignature, dotColor: "var(--cal-contract-expiration)",  textClass: "text-warning-foreground" },
  document_expiration:  { label: "Document Expires",  icon: FileClock,     dotColor: "var(--cal-document-expiration)",  textClass: "text-warning-foreground" },
  planning_task:  { label: "Planning Task", icon: ListTodo,   dotColor: "var(--cal-planning-task)",  textClass: "text-heading" },
  timeline_entry: { label: "Timeline",      icon: GanttChart, dotColor: "var(--cal-timeline-entry)", textClass: "text-heading" },
};

// Appointment classifications share one orange visual identity (Appointment).
// Hold placeholders share Hold yellow. Blocked Time reuses TYPE_META.
export const MANUAL_TYPE_META: Record<ManualScheduleType, ItemMeta> = {
  // Legacy manual Tour rows — Appointment taxonomy, not a sixth legend peer.
  tour:                 { label: "Manual tour (not booked)", icon: Ban,      dotColor: "var(--cal-meeting)", textClass: "text-heading" },
  consultation:         { label: "Consultation",         icon: Phone,     dotColor: "var(--cal-meeting)", textClass: "text-heading" },
  client_meeting:       { label: "Client Meeting",       icon: Users,     dotColor: "var(--cal-meeting)", textClass: "text-heading" },
  vendor_meeting:       { label: "Vendor Meeting",       icon: Handshake, dotColor: "var(--cal-meeting)", textClass: "text-heading" },
  walkthrough:          { label: "Walkthrough",          icon: Footprints, dotColor: "var(--cal-meeting)", textClass: "text-heading" },
  tasting:              { label: "Tasting",              icon: Utensils,  dotColor: "var(--cal-meeting)", textClass: "text-heading" },
  personal_appointment: { label: "Personal Appointment", icon: User,      dotColor: "var(--cal-meeting)", textClass: "text-heading" },
  blocked_time:         TYPE_META.calendar_block,
  // Holds — booking placeholders; must not reuse Event visual identity.
  wedding_event_booking: { label: "Hold", icon: Clock, dotColor: "var(--cal-date-hold)", textClass: "text-heading" },
  private_event:         { label: "Hold", icon: Clock, dotColor: "var(--cal-date-hold)", textClass: "text-heading" },
  other:                { label: "Other",                icon: MoreHorizontal, dotColor: "var(--cal-meeting)", textClass: "text-heading" },
  // Custom catalog offerings resolve as Appointment; label from catalogLabel.
  custom:               { label: "Custom",               icon: MoreHorizontal, dotColor: "var(--cal-meeting)", textClass: "text-heading" },
};

/** Resolves the correct visual identity for any item — manual schedule items
 * (calendar_block) resolve by their own manualType; every system-generated
 * item resolves the same way it always has, by its CalendarItemType. */
export function resolveItemMeta(item: CalendarItem): ItemMeta {
  if (item.type === "calendar_block" && item.manualType) {
    return MANUAL_TYPE_META[item.manualType];
  }
  return TYPE_META[item.type];
}

/**
 * Venue Calendar legend only — never Object.entries(TYPE_META), and never
 * appointment classifications as peer Calendar object types.
 *
 * Locked taxonomy: Event · Tour · Appointment · Hold · Blocked Time.
 * Tasting (when enabled) is an Appointment classification only — not a
 * legend entry. `tastingEnabled` is accepted for call-site compatibility
 * and does not change legend membership.
 */
export function venueCalendarLegendEntries(_options?: {
  tastingEnabled?: boolean;
}): { key: string; label: string; dotColor: string }[] {
  const colorByKey: Record<VenueCalendarTaxonomyKey, string> = {
    event: TYPE_META.event.dotColor,
    tour: TYPE_META.tour.dotColor,
    appointment: MANUAL_TYPE_META.consultation.dotColor,
    hold: TYPE_META.date_hold.dotColor,
    blocked_time: TYPE_META.calendar_block.dotColor,
  };
  return VENUE_CALENDAR_TAXONOMY.map((key) => ({
    key,
    label: venueCalendarTaxonomyLabel(key),
    dotColor: colorByKey[key],
  }));
}

export function formatTime(hhmm: string | null): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(0, 0, 0, h, m).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// ---- Item row — shared by every Calendar surface, so each renders an item
// identically: same icon, same "reveal, don't duplicate" link-out, same
// delete affordance for the one editable type (calendar_block).

export function ItemRow({
  item, onDeleteBlock, onEditBlock, deleting, showDate,
}: {
  item: CalendarItem;
  onDeleteBlock?: (blockId: string) => void;
  /** Manual Schedule Items are the one editable type; omitted on read-only surfaces (print). */
  onEditBlock?: (blockId: string) => void;
  deleting?: boolean;
  /** Agenda spans many days — show each row's own date. */
  showDate?: boolean;
}) {
  const meta = resolveItemMeta(item);
  const Icon = meta.icon;
  const typeLabel = item.catalogLabel?.trim() || meta.label;
  const isBlock = item.type === "calendar_block";
  // Calendar Booking Placeholder — a not-yet-converted one still gets the
  // block treatment (delete stays available) plus a "Convert to Lead"
  // link; once converted, it behaves like any other item — a plain link,
  // now pointed at the real Lead it became (item.link already reflects
  // this, set once in lib/calendar/service.ts).
  const isPlaceholder = isBlock && !!item.manualType && isBookingPlaceholder(item.manualType);
  const isConverted = isPlaceholder && !!item.convertedLeadId;

  const inner = (
    <>
      <span
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `color-mix(in oklch, ${meta.dotColor} 18%, transparent)`, color: meta.dotColor }}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={cn("text-xs font-semibold uppercase tracking-wide", meta.textClass)}>
            {typeLabel}
          </p>
          {showDate && (
            <span className="text-xs text-muted-foreground">
              {new Date(item.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          )}
          {/* A start with no end read as a point in time even when the item
              genuinely occupied 09:00-17:00, so an end time is shown as a
              range whenever the item carries one. */}
          {item.time && (
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {item.endTime ? `${formatTime(item.time)} – ${formatTime(item.endTime)}` : formatTime(item.time)}
            </span>
          )}
        </div>
        <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
        {item.subtitle && (
          <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
        )}
        {/* Room/staff already flow onto the item for filtering (Calendar
            Integration Phase 4) — this is the first place either renders as
            visible text, so "what room/what staff member" is answerable by
            glancing at the item, not only by using the filter dropdown. */}
        {(item.spaceName || item.assignedToName) && (
          <p className="text-xs text-muted-foreground truncate">
            {[item.spaceName, item.assignedToName].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
    </>
  );

  if (isBlock && !isConverted && item.rawId && (onDeleteBlock || onEditBlock)) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
        {inner}
        <div className="ml-1 mt-0.5 flex shrink-0 items-center gap-1">
          {isPlaceholder && (
            <Link
              href={`/leads/new?fromBlockId=${item.rawId}`}
              className="rounded px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors whitespace-nowrap"
            >
              Convert to Lead
            </Link>
          )}
          {/* Until now a manual item could only be created or deleted, so
              correcting a typo or a time meant deleting and re-entering it —
              losing the item's own history and any relationship set on it. */}
          {onEditBlock && (
            <button
              type="button"
              onClick={() => onEditBlock(item.rawId!)}
              disabled={deleting}
              className="shrink-0 rounded p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              title="Edit schedule item"
              aria-label="Edit schedule item"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {onDeleteBlock && (
            <button
              type="button"
              onClick={() => onDeleteBlock(item.rawId!)}
              disabled={deleting}
              className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Delete schedule item"
              aria-label="Delete schedule item"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <Link
      href={item.link}
      className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 hover:bg-muted/40 transition-colors"
    >
      {inner}
    </Link>
  );
}

// ---- Filter bar — taxonomy chips + staff/space -------------------------------
// Filters by locked taxonomy (Event · Tour · Appointment · Hold · Blocked Time)
// mapped onto the existing types + manualTypes axes. Perspective buckets are gone.

export function FilterBar({
  filters, onChange, presentTypes, staffOptions, spaceOptions, items = [],
}: {
  filters: import("@/components/calendar/use-calendar-filters").CalendarFilterState;
  onChange: (next: import("@/components/calendar/use-calendar-filters").CalendarFilterState) => void;
  presentTypes: CalendarItemType[];
  staffOptions: [string, string][];
  spaceOptions: [string, string][];
  /** When provided, taxonomy chips reflect items actually on the calendar. */
  items?: CalendarItem[];
}) {
  const UNASSIGNED = "__unassigned__";
  const presentTaxonomy = React.useMemo(() => {
    if (items.length > 0) return presentVenueCalendarTaxonomyKeys(items);
    // Fallback when callers pass only presentTypes (no item list): map raw types.
    const synthetic = presentTypes.flatMap((type): CalendarItem[] => {
      if (type === "calendar_block") {
        return [
          { type, manualType: "consultation" } as CalendarItem,
          { type, manualType: "blocked_time" } as CalendarItem,
          { type, manualType: "wedding_event_booking" } as CalendarItem,
        ];
      }
      return [{ type } as CalendarItem];
    });
    return presentVenueCalendarTaxonomyKeys(synthetic);
  }, [items, presentTypes]);

  const legend = venueCalendarLegendEntries();
  const activeTaxonomy = taxonomySelectionFromFilters(filters, presentTaxonomy);

  function toggleTaxonomy(key: VenueCalendarTaxonomyKey) {
    const current = activeTaxonomy.length > 0 ? activeTaxonomy : presentTaxonomy;
    const next = current.includes(key)
      ? current.filter((k) => k !== key)
      : [...current, key];
    const mapped = filtersFromTaxonomySelection(next, presentTaxonomy);
    onChange({ ...filters, types: mapped.types, manualTypes: mapped.manualTypes });
  }

  const hasActiveFilter =
    filters.types !== null ||
    filters.manualTypes !== null ||
    filters.staffId !== null ||
    filters.spaceId !== null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {presentTaxonomy.map((key) => {
          const entry = legend.find((e) => e.key === key)!;
          const active = activeTaxonomy.includes(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleTaxonomy(key)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                active ? "border-transparent bg-muted text-foreground" : "border-border text-muted-foreground opacity-50",
              )}
            >
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: entry.dotColor }} />
              {entry.label}
            </button>
          );
        })}
      </div>

      {(staffOptions.length > 0 || spaceOptions.length > 0 || hasActiveFilter) && (
        <div className="flex flex-wrap items-center gap-2">
          {staffOptions.length > 0 && (
            <select
              value={filters.staffId ?? ""}
              onChange={(e) => onChange({ ...filters, staffId: e.target.value || null })}
              className="h-7 rounded-md border border-border bg-background px-2 text-xs"
            >
              <option value="">Everyone</option>
              <option value={UNASSIGNED}>Unassigned</option>
              {staffOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          )}
          {spaceOptions.length > 0 && (
            <select
              aria-label="Space"
              value={filters.spaceId ?? ""}
              onChange={(e) => onChange({ ...filters, spaceId: e.target.value || null })}
              className="h-7 rounded-md border border-border bg-background px-2 text-xs"
            >
              <option value="">All spaces</option>
              <option value={UNASSIGNED}>No space set</option>
              {spaceOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          )}
          {hasActiveFilter && (
            <button
              type="button"
              onClick={() => onChange({ types: null, staffId: null, spaceId: null, manualTypes: null })}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const YEAR_OPTIONS = Array.from(
  { length: CALENDAR_MAX_YEAR - CALENDAR_MIN_YEAR + 1 },
  (_, i) => CALENDAR_MIN_YEAR + i,
);

/**
 * Jump straight to a distant month/year instead of walking there one
 * chevron-click at a time. The year range is the same constant the server
 * param validator uses, so every year offered here is one the resolver honours.
 */
export function MonthYearPicker({
  year, month, onChange,
}: {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Select
        value={String(month)}
        onValueChange={(v) => onChange(year, Number(v))}
        items={Object.fromEntries(MONTH_NAMES.map((m, i) => [String(i + 1), m]))}
      >
        <SelectTrigger className="h-9 w-[9.5rem]" aria-label="Month">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MONTH_NAMES.map((m, i) => (
            <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={String(year)}
        onValueChange={(v) => onChange(Number(v), month)}
        items={Object.fromEntries(YEAR_OPTIONS.map((y) => [String(y), String(y)]))}
      >
        <SelectTrigger className="h-9 w-[6rem]" aria-label="Year">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {YEAR_OPTIONS.map((y) => (
            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
