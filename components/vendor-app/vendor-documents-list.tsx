"use client";

import Link from "next/link";
import { FileText } from "lucide-react";

import { VendorLibrarySection } from "@/components/vendor-app/vendor-library-section";
import { Badge } from "@/components/ui/badge";
import { formatEventDateRange } from "@/lib/events/constants";
import type { VendorDocumentsByEvent } from "@/lib/vendor-portal/types";
import type { VendorLibraryDocument, VendorUploadedByEvent } from "@/lib/vendor-documents/types";

function EventDocGroup({
  title,
  emptyLabel,
  events,
  kind,
}: {
  title: string;
  emptyLabel: string;
  events: { assignmentId: string; eventName: string; venueName: string; eventDate: string | null; eventEndDate?: string | null; documents: { id: string; name: string; category: string; storageUrl: string; notes?: string | null }[]; floorPlans?: { id: string; name: string }[] }[];
  kind: "from-venue" | "shared-by-me";
}) {
  const withContent = events.filter((e) => e.documents.length > 0 || (e.floorPlans?.length ?? 0) > 0);

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      {withContent.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-10 text-center">
          <FileText className="h-7 w-7 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {withContent.map((ev) => (
            <div key={`${kind}-${ev.assignmentId}`} className="space-y-2">
              <div className="flex items-baseline justify-between">
                <Link href={`/vendor/events/${ev.assignmentId}`} className="text-sm font-semibold text-foreground hover:text-primary">
                  {ev.eventName}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {ev.venueName}
                  {ev.eventDate ? ` · ${formatEventDateRange(ev.eventDate, ev.eventEndDate)}` : ""}
                </span>
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
                {(ev.floorPlans ?? []).map((p) => (
                  <a key={p.id} href={`/vendor/floor-plans/${p.id}?from=${encodeURIComponent(ev.assignmentId)}`} target="_blank" rel="noopener noreferrer"
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
      )}
    </div>
  );
}

/** Vendor Documents — library + venue-shared + shared-by-me. */
export function VendorDocumentsList({
  library,
  eventsWithDocs,
  uploadedByMe,
}: {
  library: VendorLibraryDocument[];
  eventsWithDocs: VendorDocumentsByEvent[];
  uploadedByMe: VendorUploadedByEvent[];
}) {
  return (
    <div className="space-y-8">
      <VendorLibrarySection initialDocuments={library} />
      <EventDocGroup
        title="From venues"
        emptyLabel="Venue rules, loading instructions, and floor plans will appear here once shared."
        events={eventsWithDocs}
        kind="from-venue"
      />
      <EventDocGroup
        title="Shared by you"
        emptyLabel="Documents you share onto events will show up here."
        events={uploadedByMe}
        kind="shared-by-me"
      />
    </div>
  );
}
