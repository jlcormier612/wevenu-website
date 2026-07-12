"use client";

/**
 * Shared building blocks for every Calendar surface (Month grid, Week/Day/
 * Agenda views, Booking Schedule) — kept in their own file so those views
 * can import them without creating a circular dependency on
 * calendar-view.tsx, which itself renders the Week/Day/Agenda views.
 */
import * as React from "react";

import Link from "next/link";
import {
  AlertTriangle, CalendarClock, CalendarDays, Clock, ClipboardList, DollarSign,
  FileClock, FileSignature, GanttChart, ListTodo, MapPin, Phone, Star, Trash2,
} from "lucide-react";

import type { CalendarItem, CalendarItemType } from "@/lib/calendar/types";
import { cn } from "@/lib/utils";

// dotColor uses CSS custom properties (defined in globals.css) so dark-mode
// overrides in .dark { } work automatically — no JS dark-mode detection needed.
export const TYPE_META: Record<CalendarItemType, {
  label: string;
  icon: React.ElementType;
  dotColor: string;  // CSS var reference, e.g. "var(--cal-event)"
  textClass: string;
}> = {
  event:          { label: "Event",       icon: CalendarDays,  dotColor: "var(--cal-event)",       textClass: "text-primary" },
  tour:           { label: "Tour",        icon: MapPin,        dotColor: "var(--cal-tour)",        textClass: "text-muted-foreground" },
  follow_up:      { label: "Follow-up",   icon: Phone,         dotColor: "var(--cal-follow-up)",   textClass: "text-muted-foreground" },
  payment_due:    { label: "Payment Due", icon: DollarSign,    dotColor: "var(--cal-payment-due)", textClass: "text-destructive" },
  key_date:       { label: "Key Date",    icon: Star,          dotColor: "var(--cal-key-date)",    textClass: "text-heading" },
  date_hold:      { label: "Date Hold",   icon: Clock,         dotColor: "var(--cal-date-hold)",   textClass: "text-warning-foreground" },
  calendar_block: { label: "Blocked",     icon: AlertTriangle, dotColor: "var(--cal-blocked)",     textClass: "text-destructive" },
  planning_activity: { label: "Planning", icon: CalendarClock, dotColor: "var(--cal-planning-activity)", textClass: "text-heading" },
  request_due:          { label: "Request",           icon: ClipboardList, dotColor: "var(--cal-request-due)",          textClass: "text-heading" },
  contract_expiration:  { label: "Contract Expires",  icon: FileSignature, dotColor: "var(--cal-contract-expiration)",  textClass: "text-warning-foreground" },
  document_expiration:  { label: "Document Expires",  icon: FileClock,     dotColor: "var(--cal-document-expiration)",  textClass: "text-warning-foreground" },
  planning_task:  { label: "Planning Task", icon: ListTodo,   dotColor: "var(--cal-planning-task)",  textClass: "text-heading" },
  timeline_entry: { label: "Timeline",      icon: GanttChart, dotColor: "var(--cal-timeline-entry)", textClass: "text-heading" },
};

export function formatTime(hhmm: string | null): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(0, 0, 0, h, m).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// ---- Item row — shared by every Calendar surface, so each renders an item
// identically: same icon, same "reveal, don't duplicate" link-out, same
// delete affordance for the one editable type (calendar_block).

export function ItemRow({
  item, onDeleteBlock, deleting, showDate,
}: {
  item: CalendarItem;
  onDeleteBlock?: (blockId: string) => void;
  deleting?: boolean;
  /** Agenda/Booking Schedule span many days — show each row's own date. */
  showDate?: boolean;
}) {
  const meta = TYPE_META[item.type];
  const Icon = meta.icon;
  const isBlock = item.type === "calendar_block";

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
            {meta.label}
          </p>
          {showDate && (
            <span className="text-xs text-muted-foreground">
              {new Date(item.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          )}
          {item.time && (
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />{formatTime(item.time)}
            </span>
          )}
        </div>
        <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
        {item.subtitle && (
          <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
        )}
      </div>
    </>
  );

  if (isBlock && item.rawId && onDeleteBlock) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
        {inner}
        <button
          type="button"
          onClick={() => onDeleteBlock(item.rawId!)}
          disabled={deleting}
          className="ml-1 mt-0.5 shrink-0 rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          title="Delete block"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
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

// ---- Filter bar (Calendar Integration Phase 4) -------------------------------
// Multi-filtering by type + assignee + space, shared by Month/Week/Day/
// Agenda. Selections persist via useCalendarFilters (localStorage), so this
// is deliberately dumb/presentational — all state lives in the hook.

export function FilterBar({
  filters, onChange, presentTypes, staffOptions, spaceOptions,
}: {
  filters: import("@/components/calendar/use-calendar-filters").CalendarFilterState;
  onChange: (next: import("@/components/calendar/use-calendar-filters").CalendarFilterState) => void;
  presentTypes: CalendarItemType[];
  staffOptions: [string, string][];
  spaceOptions: [string, string][];
}) {
  const UNASSIGNED = "__unassigned__";
  const activeTypes = filters.types ?? presentTypes;

  function toggleType(type: CalendarItemType) {
    const current = filters.types ?? presentTypes;
    const next = current.includes(type) ? current.filter((t) => t !== type) : [...current, type];
    // Selecting everything is equivalent to "no filter" — collapses back to null
    // so a newly-appearing type on a future navigation defaults to visible.
    onChange({ ...filters, types: next.length === presentTypes.length ? null : next });
  }

  const hasActiveFilter = filters.types !== null || filters.staffId !== null || filters.spaceId !== null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {presentTypes.map((type) => {
          const meta = TYPE_META[type];
          const active = activeTypes.includes(type);
          return (
            <button
              key={type}
              type="button"
              onClick={() => toggleType(type)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                active ? "border-transparent bg-muted text-foreground" : "border-border text-muted-foreground opacity-50",
              )}
            >
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: meta.dotColor }} />
              {meta.label}
            </button>
          );
        })}
      </div>

      {(staffOptions.length > 0 || spaceOptions.length > 0) && (
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
              value={filters.spaceId ?? ""}
              onChange={(e) => onChange({ ...filters, spaceId: e.target.value || null })}
              className="h-7 rounded-md border border-border bg-background px-2 text-xs"
            >
              <option value="">Every space</option>
              <option value={UNASSIGNED}>No space set</option>
              {spaceOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          )}
          {hasActiveFilter && (
            <button
              type="button"
              onClick={() => onChange({ types: null, staffId: null, spaceId: null })}
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
