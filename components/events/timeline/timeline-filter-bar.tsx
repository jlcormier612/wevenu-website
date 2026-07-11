"use client";

/**
 * Simple Timeline filters — Section, Assigned To, Audience, Status
 * (Timeline Experience Completion task). Client-side only, filters the
 * already-loaded entry list; no search, no saved filters.
 */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { StaffMember } from "@/lib/team/types";
import { TIMELINE_AUDIENCES, type TimelineSection } from "@/lib/timeline/types";

export const ALL_FILTER = "__all__";
const ALL = ALL_FILTER;

export type TimelineStatusFilter = "all" | "upcoming" | "today" | "complete";

export function TimelineFilterBar({
  sections, teamMembers,
  sectionId, onSectionIdChange,
  assignedTo, onAssignedToChange,
  audience, onAudienceChange,
  status, onStatusChange,
}: {
  sections: TimelineSection[];
  teamMembers: StaffMember[];
  sectionId: string;
  onSectionIdChange: (v: string) => void;
  assignedTo: string;
  onAssignedToChange: (v: string) => void;
  audience: string;
  onAudienceChange: (v: string) => void;
  status: TimelineStatusFilter;
  onStatusChange: (v: TimelineStatusFilter) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Select value={sectionId} onValueChange={onSectionIdChange} items={[{ value: ALL, label: "All Sections" }, ...sections.map((s) => ({ value: s.id, label: s.name }))]}>
        <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All Sections</SelectItem>
          {sections.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={assignedTo} onValueChange={onAssignedToChange} items={[{ value: ALL, label: "Anyone" }, ...teamMembers.map((m) => ({ value: m.id, label: m.name }))]}>
        <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Anyone</SelectItem>
          {teamMembers.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={audience} onValueChange={onAudienceChange} items={[{ value: ALL, label: "All Audiences" }, ...TIMELINE_AUDIENCES.map((a) => ({ value: a.value, label: a.label }))]}>
        <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All Audiences</SelectItem>
          {TIMELINE_AUDIENCES.map((a) => <SelectItem key={a.value} value={a.value}>{a.emoji} {a.label}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={status} onValueChange={(v) => onStatusChange(v as TimelineStatusFilter)} items={[
        { value: "all", label: "All Statuses" }, { value: "upcoming", label: "Upcoming" }, { value: "today", label: "Today" }, { value: "complete", label: "Complete" },
      ]}>
        <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="upcoming">Upcoming</SelectItem>
          <SelectItem value="today">Today</SelectItem>
          <SelectItem value="complete">Complete</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
