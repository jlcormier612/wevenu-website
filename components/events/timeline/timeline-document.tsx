/**
 * Booking Timeline — the printable document (Timeline Experience Completion
 * task, Requirement 5/6). Same visual system as the Day-of Sheet document
 * (standard print grays, venue color only in the header bar) — reused, not
 * reinvented. "Print Timeline" and "Export Timeline (PDF)" both point at
 * this page; the browser's native print-to-PDF is the export mechanism,
 * same as every other "PDF export" in this app.
 */

import type { EventWithDetails } from "@/lib/events/types";
import { formatDate } from "@/lib/events/constants";
import type { StaffMember } from "@/lib/team/types";
import { formatTime } from "@/lib/timeline/constants";
import type { TimelineEntry, TimelineSection } from "@/lib/timeline/types";
import type { Venue } from "@/lib/venue/types";

export const UNSECTIONED_KEY = "__unsectioned__";

export function timelineSectionList(sections: TimelineSection[], entries: TimelineEntry[]): { key: string; name: string }[] {
  const hasUnsectioned = entries.some((e) => !e.sectionId || !sections.some((s) => s.id === e.sectionId));
  return [
    ...sections.map((s) => ({ key: s.id, name: s.name })),
    ...(hasUnsectioned ? [{ key: UNSECTIONED_KEY, name: "Unsectioned" }] : []),
  ];
}

export function TimelineDocument({
  event, venue, sections, entries, teamMembers, visibleSectionKeys,
}: {
  event: EventWithDetails;
  venue: Venue;
  sections: TimelineSection[];
  entries: TimelineEntry[];
  teamMembers: StaffMember[];
  /** null shows every section (Entire Timeline); otherwise only the keys in the set (Selected Sections only). */
  visibleSectionKeys: Set<string> | null;
}) {
  const groups = new Map<string, TimelineEntry[]>();
  sections.forEach((s) => groups.set(s.id, []));
  groups.set(UNSECTIONED_KEY, []);
  for (const e of entries) {
    const key = e.sectionId && groups.has(e.sectionId) ? e.sectionId : UNSECTIONED_KEY;
    groups.get(key)!.push(e);
  }
  for (const [, list] of groups) list.sort((a, b) => a.sortOrder - b.sortOrder);

  const sectionList = timelineSectionList(sections, entries);
  const startTime5 = event.startTime?.slice(0, 5) ?? null;

  return (
    <div className="bg-white font-sans text-sm text-gray-800">
      {/* ── Header bar ─────────────────────────────────────────────────── */}
      <div className="px-10 py-5" style={{ backgroundColor: venue.primaryColor }}>
        <div className="flex items-end justify-between">
          <div className="text-white">
            <p className="text-[10px] font-semibold uppercase tracking-widest opacity-70">Booking Timeline</p>
            <p className="mt-0.5 text-xl font-bold">{venue.name}</p>
          </div>
          <div className="text-right text-white">
            <p className="text-base font-semibold">{formatDate(event.eventDate)}</p>
          </div>
        </div>
      </div>

      {/* ── Event identity ──────────────────────────────────────────────── */}
      <div className="px-10 pt-8 pb-2">
        <p className="font-heading text-4xl font-medium tracking-tight text-gray-900">
          {event.clientName ?? event.name}
        </p>
      </div>

      {/* ── Sections ────────────────────────────────────────────────────── */}
      {sectionList.map(({ key, name }) => {
        if (visibleSectionKeys && !visibleSectionKeys.has(key)) return null;
        const list = groups.get(key) ?? [];
        if (list.length === 0) return null;
        return (
          <div key={key} className="px-10 pt-6 pb-2">
            <hr className="my-6 border-gray-100" />
            <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">{name}</p>
            <div className="space-y-2.5">
              {list.map((entry) => {
                const isStart = !!startTime5 && entry.entryTime === startTime5;
                const assignee = entry.assignedToStaffId ? teamMembers.find((m) => m.id === entry.assignedToStaffId) : null;
                return (
                  <div key={entry.id} className="flex gap-5">
                    <div className="w-20 shrink-0 text-right">
                      <span className={`text-xs font-semibold ${isStart ? "text-gray-900" : "text-gray-400"}`}>
                        {entry.entryTime ? formatTime(entry.entryTime) : ""}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1 pb-1.5 border-b border-gray-50">
                      <p className={`leading-snug ${
                        entry.status === "complete" ? "text-gray-400 line-through"
                        : isStart ? "font-semibold text-gray-900" : "text-gray-700"
                      }`}>
                        {entry.title}
                      </p>
                      {entry.description && (
                        <p className="mt-0.5 text-xs text-gray-400 italic">{entry.description}</p>
                      )}
                      {assignee && (
                        <p className="mt-0.5 text-[11px] text-gray-400">Assigned to {assignee.name}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div className="mt-8 px-10 py-4 border-t border-gray-100 flex items-center justify-between">
        <p className="text-xs text-gray-300">{venue.name}</p>
        <p className="text-xs text-gray-300">Powered by Wevenu</p>
      </div>
    </div>
  );
}
