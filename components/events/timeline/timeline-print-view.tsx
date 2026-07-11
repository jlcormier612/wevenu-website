"use client";

/**
 * "Entire Timeline" vs "Selected Sections only" (Requirement 5) — plain
 * checkboxes that show/hide sections in the on-screen preview before
 * printing; the browser print dialog then captures exactly what's visible.
 * No new print engine — same PrintButton/window.print() the Day-of Sheet
 * and Invoices already use.
 */

import * as React from "react";

import Link from "next/link";

import { PrintButton } from "@/components/events/day-sheet/print-button";
import { TimelineDocument, timelineSectionList } from "@/components/events/timeline/timeline-document";
import type { EventWithDetails } from "@/lib/events/types";
import type { StaffMember } from "@/lib/team/types";
import type { TimelineEntry, TimelineSection } from "@/lib/timeline/types";
import type { Venue } from "@/lib/venue/types";

export function TimelinePrintView({
  event, venue, sections, entries, teamMembers,
}: {
  event: EventWithDetails;
  venue: Venue;
  sections: TimelineSection[];
  entries: TimelineEntry[];
  teamMembers: StaffMember[];
}) {
  const sectionList = React.useMemo(() => timelineSectionList(sections, entries), [sections, entries]);
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set(sectionList.map((s) => s.key)));
  const allSelected = selected.size === sectionList.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(sectionList.map((s) => s.key)));
  }
  function toggleOne(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  return (
    <>
      <style>{`
        @media print {
          @page { size: letter portrait; margin: 0.55in; }
          aside, header { display: none !important; }
          .no-print  { display: none !important; }
          main { background: white !important; padding: 0 !important; }
          main > div { padding: 0 !important; max-width: none !important; }
        }
      `}</style>

      <div className="min-h-svh bg-muted/40 print:bg-white">
        {/* Screen-only toolbar */}
        <div className="no-print sticky top-0 z-50 border-b bg-background px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <Link href={`/events/${event.id}#timeline`} className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to Booking
          </Link>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-1.5 text-sm font-medium">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-3.5 w-3.5" />
              Entire Timeline
            </label>
            {sectionList.map((s) => (
              <label key={s.key} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <input type="checkbox" checked={selected.has(s.key)} onChange={() => toggleOne(s.key)} className="h-3.5 w-3.5" />
                {s.name}
              </label>
            ))}
            <PrintButton />
          </div>
        </div>

        {/* Document */}
        <div className="flex justify-center py-8 px-4 print:p-0 print:block">
          <div className="w-full max-w-[794px] overflow-hidden rounded-xl shadow-xl print:rounded-none print:shadow-none">
            <TimelineDocument
              event={event} venue={venue} sections={sections} entries={entries} teamMembers={teamMembers}
              visibleSectionKeys={selected}
            />
          </div>
        </div>
      </div>
    </>
  );
}
