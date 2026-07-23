"use client";

import Link from "next/link";
import { FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { VendorDocumentsByEvent } from "@/lib/vendor-portal/types";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Vendor Workspace Realignment, Phase 8 — every document/floor plan shared across every booked event, grouped by event. */
export function VendorDocumentsList({ eventsWithDocs }: { eventsWithDocs: VendorDocumentsByEvent[] }) {
  const withContent = eventsWithDocs.filter((e) => e.documents.length > 0 || e.floorPlans.length > 0);

  if (withContent.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-16 text-center">
        <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">No documents shared yet</p>
        <p className="text-xs text-muted-foreground mt-1">Venue rules, loading instructions, and floor plans will appear here once shared.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {withContent.map((ev) => (
        <div key={ev.eventId} className="space-y-2">
          <div className="flex items-baseline justify-between">
            <Link href={`/vendor/events/${ev.assignmentId}`} className="text-sm font-semibold text-foreground hover:text-primary">
              {ev.eventName}
            </Link>
            <span className="text-xs text-muted-foreground">{ev.venueName}{ev.eventDate ? ` · ${formatDate(ev.eventDate)}` : ""}</span>
          </div>
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {ev.documents.map((d) => (
              <a key={d.id} href={d.storageUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{d.name}</p>
                  {d.notes && <p className="text-xs text-muted-foreground">{d.notes}</p>}
                </div>
                <Badge variant="outline" className="text-xs shrink-0">{d.category}</Badge>
              </a>
            ))}
            {ev.floorPlans.map((p) => (
              <a key={p.id} href={`/vendor/floor-plans/${p.id}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{p.name}</p>
                </div>
                <Badge variant="outline" className="text-xs shrink-0">Floor Plan</Badge>
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
