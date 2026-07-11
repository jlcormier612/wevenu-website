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
import type { Document } from "@/lib/documents/types";
import type { FloorPlan } from "@/lib/floor-plans/types";
import type { Invoice } from "@/lib/invoices/types";
import type { EventTask } from "@/lib/playbooks/types";
import type {
  TimelineAudience, TimelineEntryAttachment, TimelineEntryInput, TimelineEntryLink, TimelineEntryStatus, TimelineRelatedLink, TimelineSection,
} from "@/lib/timeline/types";
import { TIMELINE_AUDIENCES } from "@/lib/timeline/types";
import type { StaffMember } from "@/lib/team/types";
import type { EventVendorAssignment } from "@/lib/vendors/types";

const NO_SECTION = "__none__";
const NO_ASSIGNEE = "__none__";

export function TimelineEntryForm({
  eventId, venueId, entryId, sections, initial, onSave, onCancel, pending, submitLabel,
  links = [], attachments = [], availableDocuments = [], onLinksChanged, onAttachmentsChanged,
  relatedLinks = [], eventTasks = [], vendorAssignments = [], floorPlans = [], conversationId = null, invoices = [], onRelatedChanged,
  teamMembers = [],
}: {
  eventId: string;
  venueId: string;
  entryId: string | null;
  sections: TimelineSection[];
  initial: TimelineEntryInput;
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
}) {
  const [title, setTitle] = React.useState(initial.title);
  const [description, setDescription] = React.useState(initial.description);
  const [notes, setNotes] = React.useState(initial.notes ?? "");
  const [entryTime, setEntryTime] = React.useState(initial.entryTime);
  const [sectionId, setSectionId] = React.useState(initial.sectionId ?? NO_SECTION);
  const [audiences, setAudiences] = React.useState<TimelineAudience[]>(
    initial.audiences ?? ["internal"]
  );
  const [clientEditable, setClientEditable] = React.useState(initial.clientEditable ?? false);
  const initialStatus: TimelineEntryStatus = initial.status ?? "not_started";
  const [isComplete, setIsComplete] = React.useState(initialStatus === "complete");
  const [assignedToStaffId, setAssignedToStaffId] = React.useState(initial.assignedToStaffId ?? NO_ASSIGNEE);

  function toggleAudience(a: TimelineAudience) {
    setAudiences(prev =>
      prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]
    );
  }

  function handleSave() {
    onSave({
      title, description, notes, entryTime, audiences,
      sectionId: sectionId === NO_SECTION ? null : sectionId,
      clientEditable: audiences.includes("couple") && clientEditable,
      // Un-checking only ever falls back to not_started — in_progress (set
      // by the live Wedding Day Dashboard) is preserved unless this box is
      // the thing that changed it.
      status: isComplete ? "complete" : (initialStatus === "complete" ? "not_started" : initialStatus),
      assignedToStaffId: assignedToStaffId === NO_ASSIGNEE ? null : assignedToStaffId,
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-ring bg-card p-4">
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
        <div className="space-y-1.5">
          <Label htmlFor="et-time" className="text-xs">Time</Label>
          <Input
            id="et-time"
            type="time"
            value={entryTime}
            onChange={(e) => setEntryTime(e.target.value)}
            className="w-32"
          />
        </div>
      </div>

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
        <input type="checkbox" checked={isComplete} onChange={(e) => setIsComplete(e.target.checked)} className="h-3.5 w-3.5" />
        Mark as complete
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
        <Label htmlFor="et-notes" className="text-xs">
          Notes <span className="font-normal text-muted-foreground">(optional, internal only)</span>
        </Label>
        <Textarea
          id="et-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Internal notes — not shown to guests or clients…"
          rows={2}
        />
      </div>

      {/* Audience visibility */}
      <div className="space-y-1.5">
        <Label className="text-xs">Visible to</Label>
        <div className="flex gap-1.5 flex-wrap">
          {TIMELINE_AUDIENCES.map(a => (
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
        {audiences.includes("guest") && (
          <p className="text-[10px] text-muted-foreground">
            🌿 This entry will appear on the wedding website&apos;s Day-of Schedule.
          </p>
        )}
        {audiences.includes("couple") && (
          <label className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={clientEditable} onChange={(e) => setClientEditable(e.target.checked)} className="h-3.5 w-3.5" />
            Let the client edit this item in the Client Timeline
          </label>
        )}
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
