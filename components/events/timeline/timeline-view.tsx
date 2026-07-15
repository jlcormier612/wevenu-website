"use client";

/**
 * Booking Timeline Experience — sections, notes, links, and attachments
 * added on top of the existing Day-of Timeline (Sprint 12) editor. Add/Edit/
 * Delete and the underlying entry model are unchanged; the reorder
 * mechanism moves from same-time-only up/down arrows to native HTML5 drag
 * (no new dependency — same primitives already used by the Pipeline
 * Template stage editor and Pipeline Board), because entries are now
 * organized into coordinator-ordered sections rather than pure time order.
 */

import * as React from "react";

import { useRouter } from "next/navigation";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  Copy,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  addEntryAction,
  addSectionAction,
  deleteEntryAction,
  deleteSectionAction,
  duplicateSectionAction,
  renameSectionAction,
  reorderEntriesAction,
  reorderSectionsAction,
  setEntryStatusAction,
  setSectionClientCanAddAction,
  updateEntryAction,
} from "@/app/(app)/events/[id]/timeline-actions";
import { TemplatePicker } from "@/components/events/timeline/template-picker";
import { TimelineEntryForm } from "@/components/events/timeline/timeline-entry-form";
import { ALL_FILTER, TimelineFilterBar, type TimelineStatusFilter } from "@/components/events/timeline/timeline-filter-bar";
import { TimelineSummaryBar } from "@/components/events/timeline/timeline-summary-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSyncedState } from "@/lib/hooks/use-synced-state";
import { formatTime, getDueStatus } from "@/lib/timeline/constants";
import type { Document } from "@/lib/documents/types";
import type { FloorPlan } from "@/lib/floor-plans/types";
import type { Invoice } from "@/lib/invoices/types";
import type { EventTask } from "@/lib/playbooks/types";
import type {
  TimelineEntry, TimelineEntryAttachment, TimelineEntryInput, TimelineEntryLink, TimelineEntryStatus, TimelineRelatedLink, TimelineSection,
} from "@/lib/timeline/types";
import { TIMELINE_AUDIENCES } from "@/lib/timeline/types";
import type { StaffMember } from "@/lib/team/types";
import { cn } from "@/lib/utils";
import type { EventVendorAssignment } from "@/lib/vendors/types";

// Stable empty fallbacks — a fresh `[]`/`{}` literal on every render would
// make useSyncedState below think the value changed on every render (since
// referential equality would never hold), causing an infinite render loop.
const EMPTY_SECTIONS: TimelineSection[] = [];
const EMPTY_LINKS: Record<string, TimelineEntryLink[]> = {};
const EMPTY_ATTACHMENTS: Record<string, TimelineEntryAttachment[]> = {};
const EMPTY_RELATED_LINKS: Record<string, TimelineRelatedLink[]> = {};

const UNSECTIONED = "__unsectioned__";
const DUE_STATUS_LABEL: Record<"upcoming" | "today" | "complete", string> = {
  upcoming: "Upcoming", today: "Today", complete: "Complete",
};

/** Bundled read-only "what can this entry link to" context — passed as one prop through Section/Row rather than five. */
type RelatedContext = {
  eventTasks: EventTask[];
  vendorAssignments: EventVendorAssignment[];
  floorPlans: FloorPlan[];
  conversationId: string | null;
  invoices: Invoice[];
};

// ---- Single timeline entry row ----------------------------------------------

const DUE_STATUS_BADGE: Record<"upcoming" | "today" | "complete", string> = {
  upcoming: "bg-muted text-muted-foreground",
  today: "bg-primary/10 text-primary",
  complete: "bg-[#5D6F5D]/10 text-[#5D6F5D]",
};

function TimelineEntryRow({
  entry, eventId, venueId, sections, links, attachments, availableDocuments,
  relatedLinks, relatedContext, onRelatedChanged,
  eventStartTime, eventDate, teamMembers, editing, onStartEdit, onCancelEdit, onDelete, onUpdate,
  onLinksChanged, onAttachmentsChanged, onDragStart, onDragEnd, isDragOver, onSetStatus,
}: {
  entry: TimelineEntry;
  eventId: string;
  venueId: string;
  sections: TimelineSection[];
  links: TimelineEntryLink[];
  attachments: TimelineEntryAttachment[];
  availableDocuments: Document[];
  relatedLinks: TimelineRelatedLink[];
  relatedContext: RelatedContext;
  onRelatedChanged: (links: TimelineRelatedLink[]) => void;
  eventStartTime: string | null;
  eventDate: string | null;
  teamMembers: StaffMember[];
  editing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, input: TimelineEntryInput) => void;
  onLinksChanged: (links: TimelineEntryLink[]) => void;
  onAttachmentsChanged: (attachments: TimelineEntryAttachment[]) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  isDragOver: boolean;
  onSetStatus: (id: string, status: TimelineEntryStatus) => void;
}) {
  const [updatePending, startUpdate] = React.useTransition();

  const isEventStart = !!eventStartTime && entry.entryTime === eventStartTime.slice(0, 5);
  const dueStatus = getDueStatus(entry.status, eventDate);
  const assignee = entry.assignedToStaffId ? teamMembers.find((m) => m.id === entry.assignedToStaffId) : null;

  function handleUpdate(input: TimelineEntryInput) {
    startUpdate(async () => {
      const result = await updateEntryAction(entry.id, eventId, input);
      if (result.ok) {
        onUpdate(entry.id, input);
      } else {
        toast.error(result.message ?? "Could not save.");
      }
    });
  }

  if (editing) {
    return (
      <TimelineEntryForm
        eventId={eventId} venueId={venueId} entryId={entry.id} sections={sections}
        initial={{
          title: entry.title,
          description: entry.description ?? "",
          notes: entry.notes ?? "",
          entryTime: entry.entryTime ?? "",
          audiences: entry.audiences,
          sectionId: entry.sectionId,
          clientEditable: entry.clientEditable,
          status: entry.status,
          assignedToStaffId: entry.assignedToStaffId,
        }}
        links={links} attachments={attachments} availableDocuments={availableDocuments}
        onLinksChanged={onLinksChanged} onAttachmentsChanged={onAttachmentsChanged}
        relatedLinks={relatedLinks} {...relatedContext} onRelatedChanged={onRelatedChanged}
        teamMembers={teamMembers}
        onSave={handleUpdate}
        onCancel={onCancelEdit}
        pending={updatePending}
        submitLabel="Save"
      />
    );
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "group flex items-start gap-2 rounded-xl border bg-card p-3 transition-colors",
        isDragOver ? "border-primary bg-primary/5" : "border-border hover:border-border/80",
        entry.status === "complete" && "opacity-70",
      )}
    >
      <div className="mt-1 shrink-0 cursor-grab text-muted-foreground" aria-label="Drag to reorder">
        <GripVertical className="h-4 w-4" />
      </div>
      <button
        type="button"
        onClick={() => onSetStatus(entry.id, entry.status === "complete" ? "not_started" : "complete")}
        className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary"
        aria-label={entry.status === "complete" ? "Mark incomplete" : "Mark complete"}
      >
        {entry.status === "complete" ? <CheckCircle2 className="h-4 w-4 text-[#5D6F5D]" /> : <Circle className="h-4 w-4" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {entry.entryTime && (
                <span className="shrink-0 text-xs font-semibold text-heading">
                  {formatTime(entry.entryTime)}
                </span>
              )}
              {isEventStart && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  Event start
                </span>
              )}
              {!entry.entryTime && (
                <span className="text-[10px] text-muted-foreground italic">No time set</span>
              )}
              <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-semibold", DUE_STATUS_BADGE[dueStatus])}>
                {DUE_STATUS_LABEL[dueStatus]}
              </span>
            </div>
            <p className={cn("mt-0.5 text-sm font-medium text-foreground", entry.status === "complete" && "line-through")}>{entry.title}</p>
            {entry.description && (
              <p className="mt-0.5 whitespace-pre-wrap text-xs text-muted-foreground">
                {entry.description}
              </p>
            )}
            {entry.notes && (
              <p className="mt-0.5 whitespace-pre-wrap text-xs italic text-muted-foreground">
                Note: {entry.notes}
              </p>
            )}
            {/* Audience badges — only show non-internal audiences */}
            {entry.audiences && entry.audiences.some(a => a !== "internal") && (
              <div className="mt-1.5 flex gap-1 flex-wrap">
                {TIMELINE_AUDIENCES.filter(a => a.value !== "internal" && entry.audiences.includes(a.value)).map(a => (
                  <span key={a.value} className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold text-white"
                    style={{ background: a.color }}>
                    {a.emoji} {a.label}
                  </span>
                ))}
              </div>
            )}
            {(links.length > 0 || attachments.length > 0 || assignee) && (
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                {assignee && <span>Assigned to {assignee.name}</span>}
                {links.length > 0 && <span>{links.length} link{links.length !== 1 ? "s" : ""}</span>}
                {attachments.length > 0 && <span>{attachments.length} attachment{attachments.length !== 1 ? "s" : ""}</span>}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={onStartEdit}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(entry.id)}
              className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              aria-label="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- One section (or the virtual Unsectioned bucket) -------------------------

function TimelineSectionBlock({
  sectionKey, name, entries, isUnsectioned, clientCanAdd, eventId, venueId, sections, eventStartTime, eventDate, teamMembers,
  linksByEntry, attachmentsByEntry, availableDocuments, relatedLinksByEntry, relatedContext,
  editingEntryId, setEditingEntryId, onDeleteEntry, onUpdateEntry, onLinksChanged, onAttachmentsChanged, onRelatedChanged, onSetStatus,
  addFormOpenFor, setAddFormOpenFor, onAddEntry, addPending,
  draggable, onSectionDragStart, onSectionDragOver, onSectionDrop, onSectionDragEnd, sectionDragOver,
  onEntryDragStart, onEntryDragEnd, onEntryDragOverRow, onEntryDropRow, onEntryDragOverEnd, onEntryDropEnd, dragOverEntryId, dragOverEnd,
  onRename, onDelete, onToggleClientCanAdd, collapsed, onToggleCollapse, onDuplicate, matchesFilter,
}: {
  sectionKey: string;
  name: string;
  entries: TimelineEntry[];
  isUnsectioned: boolean;
  clientCanAdd?: boolean;
  eventId: string;
  venueId: string;
  sections: TimelineSection[];
  eventStartTime: string | null;
  eventDate: string | null;
  teamMembers: StaffMember[];
  linksByEntry: Record<string, TimelineEntryLink[]>;
  attachmentsByEntry: Record<string, TimelineEntryAttachment[]>;
  availableDocuments: Document[];
  relatedLinksByEntry: Record<string, TimelineRelatedLink[]>;
  relatedContext: RelatedContext;
  editingEntryId: string | null;
  setEditingEntryId: (id: string | null) => void;
  onDeleteEntry: (id: string) => void;
  onUpdateEntry: (id: string, input: TimelineEntryInput) => void;
  onLinksChanged: (entryId: string, links: TimelineEntryLink[]) => void;
  onAttachmentsChanged: (entryId: string, attachments: TimelineEntryAttachment[]) => void;
  onRelatedChanged: (entryId: string, links: TimelineRelatedLink[]) => void;
  onSetStatus: (entryId: string, status: TimelineEntryStatus) => void;
  addFormOpenFor: string | null;
  setAddFormOpenFor: (key: string | null) => void;
  onAddEntry: (sectionKey: string, input: TimelineEntryInput) => void;
  addPending: boolean;
  draggable: boolean;
  onSectionDragStart?: () => void;
  onSectionDragOver?: (e: React.DragEvent) => void;
  onSectionDrop?: () => void;
  onSectionDragEnd?: () => void;
  sectionDragOver?: boolean;
  onEntryDragStart: (id: string) => void;
  onEntryDragEnd: () => void;
  onEntryDragOverRow: (e: React.DragEvent, sectionKey: string, index: number) => void;
  onEntryDropRow: (sectionKey: string, index: number) => void;
  onEntryDragOverEnd: (e: React.DragEvent, sectionKey: string) => void;
  onEntryDropEnd: (sectionKey: string) => void;
  dragOverEntryId: string | null;
  dragOverEnd: string | null;
  onRename?: (name: string) => void;
  onDelete?: () => void;
  onToggleClientCanAdd?: (value: boolean) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onDuplicate?: () => void;
  /** Simple filters (Timeline Experience Completion task) — entries stay in the full unfiltered list (drag math is unaffected); non-matching rows just don't render. */
  matchesFilter: (entry: TimelineEntry) => boolean;
}) {
  const [renaming, setRenaming] = React.useState(false);
  const [renameValue, setRenameValue] = React.useState(name);

  function commitRename() {
    if (renameValue.trim() && renameValue.trim() !== name) onRename?.(renameValue.trim());
    setRenaming(false);
  }

  return (
    <div
      className={cn("space-y-2 rounded-xl p-2 transition-colors", sectionDragOver && "bg-primary/5")}
      onDragOver={onSectionDragOver}
      onDrop={onSectionDrop}
    >
      <div className="flex items-center gap-1.5">
        {draggable && (
          <span
            draggable
            onDragStart={onSectionDragStart}
            onDragEnd={onSectionDragEnd}
            className="cursor-grab text-muted-foreground"
            aria-label="Drag to reorder section"
          >
            <GripVertical className="h-4 w-4" />
          </span>
        )}
        <button type="button" onClick={onToggleCollapse} className="text-muted-foreground hover:text-foreground" aria-label={collapsed ? "Expand section" : "Collapse section"}>
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {renaming ? (
          <div className="flex items-center gap-1">
            <Input
              value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenaming(false); }}
              autoFocus className="h-7 w-48 text-sm"
            />
            <button type="button" onClick={commitRename} className="rounded p-1 text-muted-foreground hover:text-foreground"><Check className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => setRenaming(false)} className="rounded p-1 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
          </div>
        ) : (
          <button type="button" onClick={onToggleCollapse} className="font-heading text-sm font-semibold text-heading hover:underline">{name}</button>
        )}
        <span className="text-xs text-muted-foreground">({entries.length})</span>
        {!isUnsectioned && !renaming && (
          <div className="ml-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:opacity-100">
            <button type="button" onClick={() => { setRenameValue(name); setRenaming(true); }} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Rename section">
              <Pencil className="h-3 w-3" />
            </button>
            <button type="button" onClick={onDuplicate} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Duplicate section">
              <Copy className="h-3 w-3" />
            </button>
            <button type="button" onClick={onDelete} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Delete section">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
      {collapsed ? null : (
        <>
          {!isUnsectioned && (
            <label className="flex items-center gap-1.5 pl-1 text-[11px] text-muted-foreground">
              <input type="checkbox" checked={!!clientCanAdd} onChange={(e) => onToggleClientCanAdd?.(e.target.checked)} className="h-3 w-3" />
              Client may add items to this section
            </label>
          )}

          <div className="space-y-2 pl-1">
            {entries.map((entry, i) => matchesFilter(entry) && (
              <div
                key={entry.id}
                onDragOver={(e) => onEntryDragOverRow(e, sectionKey, i)}
                onDrop={() => onEntryDropRow(sectionKey, i)}
              >
                <TimelineEntryRow
                  entry={entry} eventId={eventId} venueId={venueId} sections={sections}
                  links={linksByEntry[entry.id] ?? []} attachments={attachmentsByEntry[entry.id] ?? []}
                  availableDocuments={availableDocuments} eventStartTime={eventStartTime} eventDate={eventDate} teamMembers={teamMembers}
                  relatedLinks={relatedLinksByEntry[entry.id] ?? []} relatedContext={relatedContext}
                  editing={editingEntryId === entry.id}
                  onStartEdit={() => setEditingEntryId(entry.id)}
                  onCancelEdit={() => setEditingEntryId(null)}
                  onDelete={onDeleteEntry}
                  onUpdate={onUpdateEntry}
                  onLinksChanged={(links) => onLinksChanged(entry.id, links)}
                  onAttachmentsChanged={(attachments) => onAttachmentsChanged(entry.id, attachments)}
                  onRelatedChanged={(links) => onRelatedChanged(entry.id, links)}
                  onSetStatus={onSetStatus}
                  onDragStart={() => onEntryDragStart(entry.id)}
                  onDragEnd={onEntryDragEnd}
                  isDragOver={dragOverEntryId === entry.id}
                />
              </div>
            ))}

            {/* End-of-section drop zone — lets a dragged entry land after the last row */}
            <div
              onDragOver={(e) => onEntryDragOverEnd(e, sectionKey)}
              onDrop={() => onEntryDropEnd(sectionKey)}
              className={cn("h-3 rounded", dragOverEnd === sectionKey && "bg-primary/10")}
            />

            {addFormOpenFor === sectionKey ? (
              <TimelineEntryForm
                eventId={eventId} venueId={venueId} entryId={null} sections={sections}
                initial={{ title: "", description: "", notes: "", entryTime: "", sectionId: isUnsectioned ? null : sectionKey }}
                teamMembers={teamMembers}
                onSave={(input) => onAddEntry(sectionKey, input)}
                onCancel={() => setAddFormOpenFor(null)}
                pending={addPending}
                submitLabel="Add"
              />
            ) : (
              <button
                type="button"
                onClick={() => setAddFormOpenFor(sectionKey)}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Add item
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---- Main timeline view ----------------------------------------------------

export function TimelineView({
  eventId,
  venueId,
  eventStartTime,
  eventEndTime,
  eventDate = null,
  initialEntries,
  initialSections,
  initialLinksByEntry,
  initialAttachmentsByEntry,
  availableDocuments,
  initialRelatedLinksByEntry,
  eventTasks,
  vendorAssignments,
  floorPlans,
  conversationId,
  invoices,
  teamMembers,
}: {
  eventId: string;
  venueId: string;
  eventStartTime: string | null;
  eventEndTime: string | null;
  eventDate?: string | null;
  initialEntries: TimelineEntry[];
  initialSections?: TimelineSection[];
  initialLinksByEntry?: Record<string, TimelineEntryLink[]>;
  initialAttachmentsByEntry?: Record<string, TimelineEntryAttachment[]>;
  availableDocuments?: Document[];
  initialRelatedLinksByEntry?: Record<string, TimelineRelatedLink[]>;
  eventTasks?: EventTask[];
  vendorAssignments?: EventVendorAssignment[];
  floorPlans?: FloorPlan[];
  conversationId?: string | null;
  invoices?: Invoice[];
  teamMembers?: StaffMember[];
}) {
  const router = useRouter();
  // useSyncedState (not a plain useState(initial...)) — a real bug confirmed
  // directly against production data: applying a Timeline Template
  // (TemplatePicker, a sibling component) writes real rows and calls
  // router.refresh(), which gives this already-mounted component fresh
  // `initial*` props — but a plain useState only reads its initializer on
  // first mount, so those fresh props were never looked at again. The
  // Timeline tab's own badge count (event.timeline.length, read directly in
  // event-detail.tsx) showed the new entries correctly; this component's
  // internal state didn't, because nothing ever re-synced it. Any
  // router.refresh()-driven update — not just template application — was
  // silently invisible until a hard reload.
  const [entries, setEntries] = useSyncedState(initialEntries);
  const [sections, setSections] = useSyncedState(initialSections ?? EMPTY_SECTIONS);
  const [linksByEntry, setLinksByEntry] = useSyncedState(initialLinksByEntry ?? EMPTY_LINKS);
  const [attachmentsByEntry, setAttachmentsByEntry] = useSyncedState(initialAttachmentsByEntry ?? EMPTY_ATTACHMENTS);
  const [relatedLinksByEntry, setRelatedLinksByEntry] = useSyncedState(initialRelatedLinksByEntry ?? EMPTY_RELATED_LINKS);
  const relatedContext: RelatedContext = React.useMemo(
    () => ({ eventTasks: eventTasks ?? [], vendorAssignments: vendorAssignments ?? [], floorPlans: floorPlans ?? [], conversationId: conversationId ?? null, invoices: invoices ?? [] }),
    [eventTasks, vendorAssignments, floorPlans, conversationId, invoices],
  );
  const members = teamMembers ?? [];
  const [editingEntryId, setEditingEntryId] = React.useState<string | null>(null);
  const [addFormOpenFor, setAddFormOpenFor] = React.useState<string | null>(null);
  const [addPending, startAdd] = React.useTransition();
  const [addingSection, setAddingSection] = React.useState(false);
  const [newSectionName, setNewSectionName] = React.useState("");
  const [sectionPending, startSectionAdd] = React.useTransition();
  const [collapsedSectionIds, setCollapsedSectionIds] = React.useState<Set<string>>(new Set());

  const dragEntryId = React.useRef<string | null>(null);
  const [dragOverEntryId, setDragOverEntryId] = React.useState<string | null>(null);
  const [dragOverEnd, setDragOverEnd] = React.useState<string | null>(null);
  const dragSectionId = React.useRef<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = React.useState<string | null>(null);

  // ---- Simple filters (Section, Assigned To, Audience, Status) ----
  const [filterSectionId, setFilterSectionId] = React.useState(ALL_FILTER);
  const [filterAssignedTo, setFilterAssignedTo] = React.useState(ALL_FILTER);
  const [filterAudience, setFilterAudience] = React.useState(ALL_FILTER);
  const [filterStatus, setFilterStatus] = React.useState<TimelineStatusFilter>("all");

  function entryMatchesFilters(entry: TimelineEntry): boolean {
    if (filterSectionId !== ALL_FILTER) {
      const key = entry.sectionId ?? UNSECTIONED;
      if (key !== filterSectionId) return false;
    }
    if (filterAssignedTo !== ALL_FILTER && entry.assignedToStaffId !== filterAssignedTo) return false;
    if (filterAudience !== ALL_FILTER && !entry.audiences.includes(filterAudience as TimelineEntry["audiences"][number])) return false;
    if (filterStatus !== "all" && getDueStatus(entry.status, eventDate) !== filterStatus) return false;
    return true;
  }

  function handleLinksChanged(entryId: string, links: TimelineEntryLink[]) {
    setLinksByEntry((prev) => ({ ...prev, [entryId]: links }));
  }

  function handleAttachmentsChanged(entryId: string, attachments: TimelineEntryAttachment[]) {
    setAttachmentsByEntry((prev) => ({ ...prev, [entryId]: attachments }));
  }

  function handleRelatedChanged(entryId: string, links: TimelineRelatedLink[]) {
    setRelatedLinksByEntry((prev) => ({ ...prev, [entryId]: links }));
  }

  // Grouped, sorted view derived from flat state — server order stays a
  // sensible fallback (see getTimelineEntries), this is the display order.
  const groups = React.useMemo(() => {
    const map = new Map<string, TimelineEntry[]>();
    sections.forEach((s) => map.set(s.id, []));
    map.set(UNSECTIONED, []);
    for (const e of entries) {
      const key = e.sectionId && map.has(e.sectionId) ? e.sectionId : UNSECTIONED;
      map.get(key)!.push(e);
    }
    for (const [, list] of map) list.sort((a, b) => a.sortOrder - b.sortOrder);
    return map;
  }, [entries, sections]);

  function handleAdd(sectionKey: string, input: TimelineEntryInput) {
    startAdd(async () => {
      const targetSectionId = sectionKey === UNSECTIONED ? null : sectionKey;
      const sortOrder = (groups.get(sectionKey) ?? []).length;
      const result = await addEntryAction(eventId, { ...input, sectionId: targetSectionId, sortOrder });
      if (result.ok) {
        setEntries((prev) => [...prev, result.entry]);
        setAddFormOpenFor(null);
      } else {
        toast.error(result.message ?? "Could not add entry.");
      }
    });
  }

  async function handleDelete(entryId: string) {
    setEntries((prev) => prev.filter((e) => e.id !== entryId));
    const result = await deleteEntryAction(entryId, eventId);
    if (!result.ok) {
      toast.error("Could not delete entry.");
      router.refresh();
    }
  }

  function handleUpdate(entryId: string, input: TimelineEntryInput) {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entryId
          ? {
              ...e,
              title: input.title,
              description: input.description || null,
              notes: input.notes || null,
              entryTime: input.entryTime || null,
              audiences: input.audiences ?? e.audiences,
              sectionId: input.sectionId !== undefined ? input.sectionId : e.sectionId,
              clientEditable: input.clientEditable !== undefined ? input.clientEditable : e.clientEditable,
              status: input.status ?? e.status,
              assignedToStaffId: input.assignedToStaffId !== undefined ? input.assignedToStaffId : e.assignedToStaffId,
              updatedAt: new Date().toISOString(),
            }
          : e,
      ),
    );
    setEditingEntryId(null);
  }

  function handleSetStatus(entryId: string, status: TimelineEntryStatus) {
    setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, status, updatedAt: new Date().toISOString() } : e)));
    setEntryStatusAction(entryId, eventId, status).then((result) => {
      if (!result.ok) { toast.error(result.message ?? "Could not update status."); router.refresh(); }
    });
  }

  function handleToggleCollapse(sectionKey: string) {
    setCollapsedSectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(sectionKey)) next.delete(sectionKey); else next.add(sectionKey);
      return next;
    });
  }

  // ---- Entry drag-and-drop — persists the full list on every drop (cheap
  // at Timeline scale, and avoids partial-update edge cases). ----
  function commitEntryOrder(nextGroups: Map<string, TimelineEntry[]>) {
    const updates: { id: string; sectionId: string | null; sortOrder: number }[] = [];
    const next: TimelineEntry[] = [];
    for (const [key, list] of nextGroups) {
      list.forEach((e, i) => {
        const sectionId = key === UNSECTIONED ? null : key;
        const updated = { ...e, sectionId, sortOrder: i };
        next.push(updated);
        updates.push({ id: updated.id, sectionId, sortOrder: i });
      });
    }
    setEntries(next);
    reorderEntriesAction(eventId, updates).then((result) => {
      if (!result.ok) { toast.error("Could not save the new order."); router.refresh(); }
    });
  }

  function moveDraggedEntry(targetSectionKey: string, targetIndex: number) {
    const draggedId = dragEntryId.current;
    dragEntryId.current = null;
    setDragOverEntryId(null);
    setDragOverEnd(null);
    if (!draggedId) return;

    const dragged = entries.find((e) => e.id === draggedId);
    if (!dragged) return;
    const sourceKey = dragged.sectionId && groups.has(dragged.sectionId) ? dragged.sectionId : UNSECTIONED;

    const nextGroups = new Map(Array.from(groups.entries()).map(([k, v]) => [k, [...v]]));
    nextGroups.set(sourceKey, (nextGroups.get(sourceKey) ?? []).filter((e) => e.id !== draggedId));
    const targetList = [...(nextGroups.get(targetSectionKey) ?? [])];
    const insertAt = Math.max(0, Math.min(targetIndex, targetList.length));
    targetList.splice(insertAt, 0, dragged);
    nextGroups.set(targetSectionKey, targetList);

    commitEntryOrder(nextGroups);
  }

  function handleEntryDragOverRow(e: React.DragEvent, sectionKey: string, index: number) {
    e.preventDefault();
    e.stopPropagation();
    const list = groups.get(sectionKey) ?? [];
    setDragOverEntryId(list[index]?.id ?? null);
    setDragOverEnd(null);
  }
  function handleEntryDropRow(sectionKey: string, index: number) {
    moveDraggedEntry(sectionKey, index);
  }
  function handleEntryDragOverEnd(e: React.DragEvent, sectionKey: string) {
    e.preventDefault();
    setDragOverEnd(sectionKey);
    setDragOverEntryId(null);
  }
  function handleEntryDropEnd(sectionKey: string) {
    const list = groups.get(sectionKey) ?? [];
    moveDraggedEntry(sectionKey, list.length);
  }

  // ---- Section drag-and-drop ----
  function handleSectionDragStart(id: string) { dragSectionId.current = id; }
  function handleSectionDragEnd() { dragSectionId.current = null; setDragOverSectionId(null); }
  function handleSectionDragOver(e: React.DragEvent, id: string) { e.preventDefault(); setDragOverSectionId(id); }
  function handleSectionDrop(targetId: string) {
    const draggedId = dragSectionId.current;
    dragSectionId.current = null;
    setDragOverSectionId(null);
    if (!draggedId || draggedId === targetId) return;
    setSections((prev) => {
      const list = [...prev];
      const fromIdx = list.findIndex((s) => s.id === draggedId);
      const toIdx = list.findIndex((s) => s.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const [moved] = list.splice(fromIdx, 1);
      list.splice(toIdx, 0, moved);
      reorderSectionsAction(eventId, list.map((s) => s.id)).then((result) => {
        if (!result.ok) { toast.error("Could not save section order."); router.refresh(); }
      });
      return list;
    });
  }

  function handleAddSection() {
    if (!newSectionName.trim()) return;
    startSectionAdd(async () => {
      const result = await addSectionAction(eventId, newSectionName.trim(), sections.length);
      if (result.ok) {
        setSections((p) => [...p, result.section]);
        setNewSectionName("");
        setAddingSection(false);
      } else {
        toast.error(result.message ?? "Could not add section.");
      }
    });
  }

  async function handleRenameSection(sectionId: string, name: string) {
    const result = await renameSectionAction(sectionId, eventId, name);
    if (result.ok) setSections((p) => p.map((s) => (s.id === sectionId ? { ...s, name } : s)));
    else toast.error(result.message ?? "Could not rename section.");
  }

  async function handleDeleteSection(section: TimelineSection) {
    if (!confirm(`Delete "${section.name}"? Its items move to Unsectioned — nothing is deleted.`)) return;
    const result = await deleteSectionAction(section.id, eventId);
    if (result.ok) {
      setSections((p) => p.filter((s) => s.id !== section.id));
      setEntries((p) => p.map((e) => (e.sectionId === section.id ? { ...e, sectionId: null } : e)));
    } else {
      toast.error(result.message ?? "Could not delete section.");
    }
  }

  async function handleToggleClientCanAdd(sectionId: string, value: boolean) {
    setSections((p) => p.map((s) => (s.id === sectionId ? { ...s, clientCanAdd: value } : s)));
    const result = await setSectionClientCanAddAction(sectionId, eventId, value);
    if (!result.ok) {
      toast.error(result.message ?? "Could not update this setting.");
      setSections((p) => p.map((s) => (s.id === sectionId ? { ...s, clientCanAdd: !value } : s)));
    }
  }

  async function handleDuplicateSection(section: TimelineSection) {
    const result = await duplicateSectionAction(eventId, section.id, sections.length);
    if (result.ok) {
      setSections((p) => [...p, result.section]);
      setEntries((p) => [...p, ...result.entries]);
      toast.success(`Duplicated "${section.name}".`);
    } else {
      toast.error(result.message ?? "Could not duplicate section.");
    }
  }

  const totalCount = entries.length;
  const lastUpdatedIso = [...entries.map((e) => e.updatedAt), ...sections.map((s) => s.updatedAt)]
    .sort()
    .at(-1) ?? null;

  // Empty state — no entries and no sections yet
  if (totalCount === 0 && sections.length === 0 && addFormOpenFor === null) {
    return (
      <div className="space-y-4">
        <TimelineSummaryBar eventStartTime={eventStartTime} eventEndTime={eventEndTime} itemCount={0} lastUpdated={lastUpdatedIso} />
        <div className="flex items-center justify-end">
          <TemplatePicker
            eventId={eventId}
            eventStartTime={eventStartTime}
            onApplied={() => router.refresh()}
          />
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 py-16 text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Clock className="h-5 w-5" />
          </span>
          <p className="font-heading text-base font-medium text-heading">No timeline yet</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Build the day-of schedule entry by entry, or start from a template.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Button type="button" onClick={() => setAddFormOpenFor(UNSECTIONED)}>
              <Plus className="mr-1 h-4 w-4" /> Add First Entry
            </Button>
            <TemplatePicker
              eventId={eventId}
              eventStartTime={eventStartTime}
              onApplied={() => router.refresh()}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <TimelineSummaryBar eventStartTime={eventStartTime} eventEndTime={eventEndTime} itemCount={totalCount} lastUpdated={lastUpdatedIso} />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TimelineFilterBar
          sections={sections} teamMembers={members}
          sectionId={filterSectionId} onSectionIdChange={setFilterSectionId}
          assignedTo={filterAssignedTo} onAssignedToChange={setFilterAssignedTo}
          audience={filterAudience} onAudienceChange={setFilterAudience}
          status={filterStatus} onStatusChange={setFilterStatus}
        />
        <div className="flex items-center gap-2">
          <TemplatePicker
            eventId={eventId}
            eventStartTime={eventStartTime}
            onApplied={() => router.refresh()}
            existingEntryCount={totalCount}
          />
          {addingSection ? (
            <div className="flex items-center gap-1">
              <Input
                value={newSectionName} onChange={(e) => setNewSectionName(e.target.value)}
                placeholder="Section name" autoFocus className="h-8 w-40 text-sm"
                onKeyDown={(e) => { if (e.key === "Enter") handleAddSection(); if (e.key === "Escape") setAddingSection(false); }}
              />
              <Button type="button" size="sm" className="h-8 px-2" disabled={!newSectionName.trim() || sectionPending} onClick={handleAddSection}>
                {sectionPending ? "…" : <Check className="h-3.5 w-3.5" />}
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-8 px-2" onClick={() => setAddingSection(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => setAddingSection(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add Section
            </Button>
          )}
        </div>
      </div>

      {/* Sections, in order, then the Unsectioned bucket */}
      <div className="space-y-5">
        {sections.map((section) => (
          <TimelineSectionBlock
            key={section.id}
            sectionKey={section.id}
            name={section.name}
            entries={groups.get(section.id) ?? []}
            isUnsectioned={false}
            clientCanAdd={section.clientCanAdd}
            onToggleClientCanAdd={(value) => handleToggleClientCanAdd(section.id, value)}
            eventId={eventId} venueId={venueId} sections={sections} eventStartTime={eventStartTime} eventDate={eventDate} teamMembers={members}
            linksByEntry={linksByEntry} attachmentsByEntry={attachmentsByEntry} availableDocuments={availableDocuments ?? []}
            relatedLinksByEntry={relatedLinksByEntry} relatedContext={relatedContext}
            editingEntryId={editingEntryId} setEditingEntryId={setEditingEntryId}
            onDeleteEntry={handleDelete} onUpdateEntry={handleUpdate}
            onLinksChanged={handleLinksChanged} onAttachmentsChanged={handleAttachmentsChanged} onRelatedChanged={handleRelatedChanged}
            onSetStatus={handleSetStatus}
            addFormOpenFor={addFormOpenFor} setAddFormOpenFor={setAddFormOpenFor}
            onAddEntry={handleAdd} addPending={addPending}
            draggable
            onSectionDragStart={() => handleSectionDragStart(section.id)}
            onSectionDragOver={(e) => handleSectionDragOver(e, section.id)}
            onSectionDrop={() => handleSectionDrop(section.id)}
            onSectionDragEnd={handleSectionDragEnd}
            sectionDragOver={dragOverSectionId === section.id}
            onEntryDragStart={(id) => (dragEntryId.current = id)}
            onEntryDragEnd={() => { dragEntryId.current = null; setDragOverEntryId(null); setDragOverEnd(null); }}
            onEntryDragOverRow={handleEntryDragOverRow}
            onEntryDropRow={handleEntryDropRow}
            onEntryDragOverEnd={handleEntryDragOverEnd}
            onEntryDropEnd={handleEntryDropEnd}
            dragOverEntryId={dragOverEntryId}
            dragOverEnd={dragOverEnd}
            onRename={(name) => handleRenameSection(section.id, name)}
            onDelete={() => handleDeleteSection(section)}
            onDuplicate={() => handleDuplicateSection(section)}
            collapsed={collapsedSectionIds.has(section.id)}
            onToggleCollapse={() => handleToggleCollapse(section.id)}
            matchesFilter={entryMatchesFilters}
          />
        ))}

        {(sections.length > 0 || (groups.get(UNSECTIONED) ?? []).length > 0 || addFormOpenFor === UNSECTIONED) && (
          <TimelineSectionBlock
            sectionKey={UNSECTIONED}
            name="Unsectioned"
            entries={groups.get(UNSECTIONED) ?? []}
            isUnsectioned
            eventId={eventId} venueId={venueId} sections={sections} eventStartTime={eventStartTime} eventDate={eventDate} teamMembers={members}
            linksByEntry={linksByEntry} attachmentsByEntry={attachmentsByEntry} availableDocuments={availableDocuments ?? []}
            relatedLinksByEntry={relatedLinksByEntry} relatedContext={relatedContext}
            editingEntryId={editingEntryId} setEditingEntryId={setEditingEntryId}
            onDeleteEntry={handleDelete} onUpdateEntry={handleUpdate}
            onLinksChanged={handleLinksChanged} onAttachmentsChanged={handleAttachmentsChanged} onRelatedChanged={handleRelatedChanged}
            onSetStatus={handleSetStatus}
            addFormOpenFor={addFormOpenFor} setAddFormOpenFor={setAddFormOpenFor}
            onAddEntry={handleAdd} addPending={addPending}
            draggable={false}
            onEntryDragStart={(id) => (dragEntryId.current = id)}
            onEntryDragEnd={() => { dragEntryId.current = null; setDragOverEntryId(null); setDragOverEnd(null); }}
            onEntryDragOverRow={handleEntryDragOverRow}
            onEntryDropRow={handleEntryDropRow}
            onEntryDragOverEnd={handleEntryDragOverEnd}
            onEntryDropEnd={handleEntryDropEnd}
            dragOverEntryId={dragOverEntryId}
            dragOverEnd={dragOverEnd}
            collapsed={collapsedSectionIds.has(UNSECTIONED)}
            onToggleCollapse={() => handleToggleCollapse(UNSECTIONED)}
            matchesFilter={entryMatchesFilters}
          />
        )}
      </div>
    </div>
  );
}
