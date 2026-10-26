"use client";

/**
 * Shared Add/Edit form for a Timeline item. Extracted from timeline-view.tsx
 * and extended with Notes, Section, Links, and Attachments (Booking Timeline
 * Experience task) — Title, Time, Description, and Audience are the existing
 * fields, unchanged in behavior. Links and Attachments need a real entry id
 * to attach to, so — same as Planning Template tasks — they're only offered
 * once the item has been saved once.
 */

import * as React from "react";

import { Check, X } from "lucide-react";

import { TimelineAttachmentsField } from "@/components/events/timeline/timeline-attachments-field";
import { TimelineLinksField } from "@/components/events/timeline/timeline-links-field";
import { TimelineRelatedField } from "@/components/events/timeline/timeline-related-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TimeAmPmInput } from "@/components/ui/time-ampm-input";
import type { Document } from "@/lib/documents/types";
import type { FloorPlan } from "@/lib/floor-plans/types";
import type { Invoice } from "@/lib/invoices/types";
import type { EventTask } from "@/lib/playbooks/types";
import {
  INTERNAL_NOTES_PRIVACY_HINT,
  internalNotesLabel,
} from "@/lib/notes/internal-notes-copy";
import type {
  TimelineAudience, TimelineEntryAttachment, TimelineEntryInput, TimelineEntryLink, TimelineRelatedLink, TimelineSection,
} from "@/lib/timeline/types";
import { VENUE_OWNED_DEFAULT_AUDIENCES } from "@/lib/timeline/audience-ownership";
import { VENUE_TIMELINE_AUDIENCES } from "@/lib/timeline/types";
import { addDaysToIsoDate, timelineDayOptions } from "@/lib/timeline/constants";
import {
  provenanceFromVenueChoice,
  type TimingProvenance,
} from "@/lib/timeline/timing-provenance";
import type { TimelineDayAnchor } from "@/lib/timeline/timing-presentation";
import type { StaffMember } from "@/lib/team/types";
import type { EventVendorAssignment } from "@/lib/vendors/types";

const NO_SECTION = "__none__";
const NO_ASSIGNEE = "__none__";

/** Form seed: display fields plus read-model provenance (not a TimingWrite). */
type TimelineEntryFormInitial = Omit<TimelineEntryInput, "timing"> & {
  timing?: TimingProvenance;
};

export function TimelineEntryForm({
  eventId, venueId, entryId, sections, initial, onSave, onCancel, pending, submitLabel,
  links = [], attachments = [], availableDocuments = [], onLinksChanged, onAttachmentsChanged,
  relatedLinks = [], eventTasks = [], vendorAssignments = [], floorPlans = [], conversationId = null, invoices = [], onRelatedChanged,
  teamMembers = [],
  eventDate = null, eventEndDate = null,
}: {
  eventId: string;
  venueId: string;
  entryId: string | null;
  sections: TimelineSection[];
  initial: TimelineEntryFormInitial;
  onSave: (input: TimelineEntryInput) => void;
  onCancel: () => void;
  pending: boolean;
  submitLabel: string;
  links?: TimelineEntryLink[];
  attachments?: TimelineEntryAttachment[];
  availableDocuments?: Document[];
  onLinksChanged?: (links: TimelineEntryLink[]) => void;
  onAttachmentsChanged?: (attachments: TimelineEntryAttachment[]) => void;
  relatedLinks?: TimelineRelatedLink[];
  eventTasks?: EventTask[];
  vendorAssignments?: EventVendorAssignment[];
  floorPlans?: FloorPlan[];
  conversationId?: string | null;
  invoices?: Invoice[];
  onRelatedChanged?: (links: TimelineRelatedLink[]) => void;
  teamMembers?: StaffMember[];
  eventDate?: string | null;
  eventEndDate?: string | null;
}) {
  const [title, setTitle] = React.useState(initial.title);
  const [description, setDescription] = React.useState(initial.description);
  const [notes, setNotes] = React.useState(initial.notes ?? "");
  const [entryTime, setEntryTime] = React.useState(initial.entryTime);
  const [dayOffset, setDayOffset] = React.useState(String(initial.dayOffset ?? 0));
  const [sectionId, setSectionId] = React.useState(initial.sectionId ?? NO_SECTION);
  const [audiences, setAudiences] = React.useState<TimelineAudience[]>(
    initial.audiences ?? [...VENUE_OWNED_DEFAULT_AUDIENCES]
  );
  // Structural milestones lock by default (docs/client-workspace-product-
  // architecture.md §12) — a safety rail against accidental drift, always
  // one click to unlock. Never gates a cross-party edit; only the item's
  // own owner (always the venue, from this form) can toggle it.
  const [isLocked, setIsLocked] = React.useState((initial.lockState ?? "locked") === "locked");
  const [assignedToStaffId, setAssignedToStaffId] = React.useState(initial.assignedToStaffId ?? NO_ASSIGNEE);
  const legacyTiming = !initial.timing || initial.timing.dayIntent == null || initial.timing.dayIntent === "unknown";
  const [dayMode, setDayMode] = React.useState<"unset" | "relative" | "fixed">(
    initial.timing?.dayIntent === "fixed" ? "fixed" : initial.timing?.dayIntent === "relative" ? "relative" : entryId ? "unset" : "relative",
  );
  const [dayAnchor, setDayAnchor] = React.useState<TimelineDayAnchor>(initial.timing?.dayAnchor ?? "event_start");
  const [fixedDate, setFixedDate] = React.useState(
    initial.timing?.fixedDate ?? (eventDate ? addDaysToIsoDate(eventDate, initial.dayOffset ?? 0) : ""),
  );
  const [clockMode, setClockMode] = React.useState<"clock" | "relative" | "untimed">(
    initial.timing?.clockIntent === "relative" ? "relative" : initial.entryTime ? "clock" : "untimed",
  );
  const [relativeMinutes, setRelativeMinutes] = React.useState(String(initial.timing?.relativeMinutes ?? 0));
  const [endRelativeOffset, setEndRelativeOffset] = React.useState(
    String(initial.timing?.dayAnchor === "event_end" ? (initial.timing.relativeDayOffset ?? 0) : 0),
  );

  const dayOptions = eventDate ? timelineDayOptions(eventDate, eventEndDate) : [];
  // Always offer the planning-day selector when the event has a start date
  // (includes prep/loadout days outside the event span).
  const showDayPicker = Boolean(eventDate) && dayOptions.length > 0;

  function toggleAudience(a: TimelineAudience) {
    setAudiences(prev =>
      prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]
    );
  }

  function handleSave() {
    const displayOffset = Number(dayOffset) || 0;
    const clockIntent = clockMode === "relative" ? "relative" as const : clockMode === "clock" && entryTime ? "explicit" as const : "untimed" as const;
    const timing = dayMode === "unset" ? undefined : provenanceFromVenueChoice({
      choice: dayMode,
      dayAnchor,
      relativeDayOffset: dayAnchor === "event_end" ? Number(endRelativeOffset) || 0 : displayOffset,
      templateDayOffset: initial.timing?.templateDayOffset ?? null,
      templateDayAnchor: initial.timing?.templateDayAnchor ?? null,
      fixedDate: fixedDate || null,
      eventDate,
      eventEndDate,
      previousDayOffset: initial.dayOffset ?? displayOffset,
      clockIntent,
      relativeMinutes: clockMode === "relative" ? Number(relativeMinutes) || 0 : null,
      explicitEntryTime: entryTime || null,
      clockOverridden: clockIntent === "explicit" || Boolean(initial.timing?.clockOverridden && clockIntent !== "relative"),
    });
    onSave({
      title, description, notes, entryTime: timing?.entryTime ?? entryTime,
      dayOffset: timing?.dayOffset ?? displayOffset,
      audiences,
      sectionId: sectionId === NO_SECTION ? null : sectionId,
      lockState: isLocked ? "locked" : "editable",
      status: initial.status ?? "not_started",
      assignedToStaffId: assignedToStaffId === NO_ASSIGNEE ? null : assignedToStaffId,
      ...(timing ? { timing } : {}),
    });
  }

  return (
    <div className="space-y-3 rounded-sm border border-ring bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="space-y-1.5">
          <Label htmlFor="et-title" className="text-xs">Title *</Label>
          <Input
            id="et-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ceremony begins"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSave();
            }}
          />
        </div>
        <div className="flex flex-wrap gap-3">
          {showDayPicker && (
            <div className="space-y-1.5">
              <Label className="text-xs">Day</Label>
              <Select
                value={dayOffset}
                onValueChange={setDayOffset}
                items={dayOptions.map((d) => ({ value: String(d.value), label: d.label }))}
              >
                <SelectTrigger className="h-9 text-sm w-[11.5rem]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {dayOptions.map((d) => (
                    <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {legacyTiming && entryId ? (
            <p className="text-[11px] text-muted-foreground max-w-xs" data-testid="timeline-timing-unknown">
              Timing choice is not recorded for this item. It stays as saved until you choose relative or a fixed date below.
            </p>
          ) : null}
          {initial.timing?.attention === "missing_event_end" || initial.timing?.attention === "invalid_event_end" ? (
            <p className="text-[11px] text-amber-800 max-w-xs" data-testid="timeline-timing-end-attention">
              Needs a wedding end date. The saved day was not rewritten.
            </p>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="et-time" className="text-xs">Time</Label>
            <TimeAmPmInput
              id="et-time"
              value={entryTime}
              onChange={setEntryTime}
              className="w-32"
              data-testid="timeline-entry-time"
            />
          </div>
        </div>
      </div>

      <details className="rounded-sm border border-border px-3 py-2" data-testid="timeline-timing-controls">
        <summary className="cursor-pointer text-xs font-medium text-heading">Day and clock timing</summary>
        <div className="mt-2 space-y-2">
          <p className="text-[11px] text-muted-foreground">
            Relative days move with the wedding date. A fixed date stays on that calendar day. Sharing this timeline does not by itself change either one.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`rounded-full border px-2.5 py-1 text-[11px] ${dayMode === "relative" ? "border-primary bg-primary/10" : "border-border text-muted-foreground"}`}
              onClick={() => setDayMode("relative")}
            >
              Relative to the wedding
            </button>
            <button
              type="button"
              className={`rounded-full border px-2.5 py-1 text-[11px] ${dayMode === "fixed" ? "border-primary bg-primary/10" : "border-border text-muted-foreground"}`}
              onClick={() => setDayMode("fixed")}
            >
              Fixed calendar date
            </button>
          </div>
          {dayMode === "relative" ? (
            <div className="space-y-2">
              <label className="block text-[11px] text-muted-foreground">
                Measured from
                <select
                  className="mt-1 block h-8 rounded-sm border border-border bg-card px-2 text-xs text-foreground"
                  value={dayAnchor}
                  onChange={(e) => setDayAnchor(e.target.value as TimelineDayAnchor)}
                >
                  <option value="event_start">Wedding start</option>
                  <option value="event_end">Wedding end</option>
                </select>
              </label>
              {dayAnchor === "event_start" ? (
                <p className="text-[11px] text-muted-foreground">Use the Day menu for how many days before or after the wedding start.</p>
              ) : (
                <label className="block text-[11px] text-muted-foreground">
                  Days from the wedding end (negative is before)
                  <input
                    type="number"
                    className="mt-1 block h-8 w-28 rounded-sm border border-border bg-card px-2 text-xs text-foreground"
                    value={endRelativeOffset}
                    onChange={(e) => setEndRelativeOffset(e.target.value)}
                  />
                </label>
              )}
            </div>
          ) : null}
          {dayMode === "fixed" ? (
            <label className="block text-[11px] text-muted-foreground">
              Calendar date
              <input
                type="date"
                className="mt-1 block h-8 rounded-sm border border-border bg-card px-2 text-xs text-foreground"
                value={fixedDate}
                onChange={(e) => setFixedDate(e.target.value)}
                data-testid="timeline-fixed-date"
              />
            </label>
          ) : null}
          <label className="block text-[11px] text-muted-foreground">
            Clock
            <select
              className="mt-1 block h-8 rounded-sm border border-border bg-card px-2 text-xs text-foreground"
              value={clockMode}
              onChange={(e) => setClockMode(e.target.value as "clock" | "relative" | "untimed")}
            >
              <option value="clock">Exact time</option>
              <option value="relative">Minutes from Day-of start</option>
              <option value="untimed">No clock time</option>
            </select>
          </label>
          {clockMode === "relative" ? (
            <label className="block text-[11px] text-muted-foreground">
              Minutes after Day-of start (negative for before)
              <input
                type="number"
                className="mt-1 block h-8 w-28 rounded-sm border border-border bg-card px-2 text-xs text-foreground"
                value={relativeMinutes}
                onChange={(e) => setRelativeMinutes(e.target.value)}
              />
            </label>
          ) : null}
        </div>
      </details>

      <div className="grid gap-3 sm:grid-cols-2">
        {sections.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs">Section</Label>
            <Select value={sectionId} onValueChange={setSectionId} items={[{ value: NO_SECTION, label: "No section" }, ...sections.map((s) => ({ value: s.id, label: s.name }))]}>
              <SelectTrigger className="h-9 text-sm w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SECTION}>No section</SelectItem>
                {sections.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1.5">
          <Label className="text-xs">Assigned To <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Select value={assignedToStaffId} onValueChange={setAssignedToStaffId} items={[{ value: NO_ASSIGNEE, label: "Unassigned" }, ...teamMembers.map((m) => ({ value: m.id, label: m.name }))]}>
            <SelectTrigger className="h-9 text-sm w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_ASSIGNEE}>Unassigned</SelectItem>
              {teamMembers.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={isLocked} onChange={(e) => setIsLocked(e.target.checked)} className="h-3.5 w-3.5" />
        🔒 Lock this item (structural — prevent accidental changes)
      </label>

      <div className="space-y-1.5">
        <Label htmlFor="et-desc" className="text-xs">
          Description <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="et-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Any details for the team…"
          rows={2}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="et-notes" className="text-xs">{internalNotesLabel("timeline")}</Label>
        <p className="text-[11px] text-muted-foreground">{INTERNAL_NOTES_PRIVACY_HINT}</p>
        <Textarea
          id="et-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Operational notes…"
          rows={2}
        />
      </div>

      {/* Share with — venue-owned items: Client + Vendors only.
          Wedding Party and Guests are client-controlled audiences. */}
      <div className="space-y-1.5">
        <Label className="text-xs">Share with</Label>
        <div className="flex gap-1.5 flex-wrap">
          {VENUE_TIMELINE_AUDIENCES.map(a => (
            <button
              key={a.value}
              type="button"
              onClick={() => toggleAudience(a.value)}
              className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                audiences.includes(a.value)
                  ? "text-white border-transparent"
                  : "border-border text-muted-foreground hover:border-ring"
              }`}
              style={audiences.includes(a.value) ? { background: a.color } : {}}
            >
              {a.emoji} {a.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Links <span className="font-normal text-muted-foreground">(optional)</span></Label>
        {entryId ? (
          <TimelineLinksField eventId={eventId} timelineEntryId={entryId} links={links} onChanged={(l) => onLinksChanged?.(l)} />
        ) : (
          <p className="text-xs text-muted-foreground italic">Save this item to add links.</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Attachments <span className="font-normal text-muted-foreground">(optional)</span></Label>
        {entryId ? (
          <TimelineAttachmentsField
            eventId={eventId} venueId={venueId} timelineEntryId={entryId}
            attachments={attachments} availableDocuments={availableDocuments}
            onChanged={(a) => onAttachmentsChanged?.(a)}
          />
        ) : (
          <p className="text-xs text-muted-foreground italic">Save this item to add attachments.</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Related <span className="font-normal text-muted-foreground">(optional)</span></Label>
        {entryId ? (
          <TimelineRelatedField
            eventId={eventId} timelineEntryId={entryId} relatedLinks={relatedLinks}
            eventTasks={eventTasks} vendorAssignments={vendorAssignments} floorPlans={floorPlans}
            conversationId={conversationId} invoices={invoices}
            onChanged={(l) => onRelatedChanged?.(l)}
          />
        ) : (
          <p className="text-xs text-muted-foreground italic">Save this item to link a Planning task, vendor, floor plan, conversation, or invoice.</p>
        )}
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
          <X className="mr-1 h-3.5 w-3.5" />Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!title.trim() || pending}
          onClick={handleSave}
        >
          <Check className="mr-1 h-3.5 w-3.5" />
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </div>
  );
}
