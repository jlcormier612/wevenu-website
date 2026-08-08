"use client";

import * as React from "react";
import { FileText } from "lucide-react";

import { VendorEventSharePanel } from "@/components/vendor-app/vendor-event-share-panel";
import { Badge } from "@/components/ui/badge";
import type { VendorEventDetail } from "@/lib/vendors/types";
import type { VendorEventUpload, VendorLibraryDocument } from "@/lib/vendor-documents/types";
import type { VendorFloorPlanSummary } from "@/lib/floor-plans/types";
import { cn } from "@/lib/utils";

type FolderFilter = "all" | "from_venue" | "from_you" | "with_couple";

type FolderItem = {
  id: string;
  name: string;
  href: string;
  categoryLabel: string;
  notes?: string | null;
  source: "venue" | "you";
  withCouple: boolean;
  isFloorPlan?: boolean;
};

// Residual (couple→vendor share): couple_documents has share_with_venue but no
// shared_with_vendors path into get_vendor_event_detail. Shipping that needs a
// column + RPC union + portal checkbox + a "from couple" folder source — defer.

const FILTERS: { id: FolderFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "from_venue", label: "From venue" },
  { id: "from_you", label: "Shared by you" },
  { id: "with_couple", label: "With couple" },
];

/**
 * Unified event document folder for vendors — one list with party chips
 * instead of separate "From venue" / "Shared with venue" stacks.
 */
export function VendorEventDocumentFolder({
  detail,
  library,
  uploads,
  floorPlans,
  highlight = false,
}: {
  detail: VendorEventDetail;
  library: VendorLibraryDocument[];
  uploads: VendorEventUpload[];
  floorPlans: VendorFloorPlanSummary[];
  highlight?: boolean;
}) {
  const [filter, setFilter] = React.useState<FolderFilter>(highlight ? "from_venue" : "all");
  const folderRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!highlight || !folderRef.current) return;
    folderRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [highlight]);

  const items = React.useMemo<FolderItem[]>(() => {
    const venueDocs: FolderItem[] = detail.documents.map((d) => ({
      id: `venue-${d.id}`,
      name: d.name,
      href: d.storageUrl,
      categoryLabel: d.category,
      notes: d.notes,
      source: "venue",
      withCouple: false,
    }));
    const plans: FolderItem[] = floorPlans.map((p) => ({
      id: `plan-${p.id}`,
      name: p.name,
      href: `/vendor/floor-plans/${p.id}?from=${encodeURIComponent(detail.assignmentId)}`,
      categoryLabel: "Floor Plan",
      source: "venue",
      withCouple: false,
      isFloorPlan: true,
    }));
    const yours: FolderItem[] = uploads.map((d) => ({
      id: `you-${d.id}`,
      name: d.name,
      href: d.storageUrl,
      categoryLabel: d.category,
      notes: d.notes,
      source: "you",
      withCouple: !!d.isCoupleVisible,
    }));
    return [...venueDocs, ...plans, ...yours];
  }, [detail.assignmentId, detail.documents, floorPlans, uploads]);

  const counts = React.useMemo(() => ({
    all: items.length,
    from_venue: items.filter((i) => i.source === "venue").length,
    from_you: items.filter((i) => i.source === "you").length,
    with_couple: items.filter((i) => i.withCouple).length,
  }), [items]);

  const visible = items.filter((item) => {
    if (filter === "from_venue") return item.source === "venue";
    if (filter === "from_you") return item.source === "you";
    if (filter === "with_couple") return item.withCouple;
    return true;
  });

  return (
    <div
      ref={folderRef}
      className={cn("space-y-4 rounded-sm p-1 -m-1", highlight && "ring-2 ring-primary/25 bg-primary/5")}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Event folder</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Files for this booking — from {detail.venueName}, shared by you, and (when enabled) with the couple.
          </p>
          {highlight && (
            <p className="text-[11px] font-medium text-primary mt-1">Shared documents for this event</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-sm border px-2.5 py-1 text-[11px] font-medium transition-colors",
              filter === f.id
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
            <span className="ml-1 tabular-nums opacity-70">{counts[f.id]}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-sm border border-dashed border-border py-10 text-center">
          <FileText className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {filter === "all"
              ? "Nothing in this event folder yet. Share a Document Library file or upload below."
              : filter === "from_venue"
                ? "The venue hasn’t shared documents or floor plans for this event yet."
                : filter === "from_you"
                  ? "You haven’t shared anything onto this event yet."
                  : "Nothing shared with the couple on this event yet."}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-sm border border-border bg-card">
          {visible.map((item, idx) => (
            <a
              key={item.id}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40",
                highlight && idx === 0 && filter === "from_venue" && "bg-primary/5",
              )}
            >
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{item.name}</p>
                {item.notes ? <p className="text-xs text-muted-foreground">{item.notes}</p> : null}
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                <Badge variant="outline" className="text-[10px]">
                  {item.source === "venue" ? "From venue" : "Shared by you"}
                </Badge>
                {item.withCouple ? (
                  <Badge variant="outline" className="text-[10px] border-[color-mix(in_oklch,var(--dusty-rose)_40%,var(--border))]">
                    With couple
                  </Badge>
                ) : null}
                <Badge variant="outline" className="text-[10px]">{item.categoryLabel}</Badge>
              </div>
            </a>
          ))}
        </div>
      )}

      <VendorEventSharePanel
        assignmentId={detail.assignmentId}
        eventId={detail.eventId}
        library={library}
        uploads={uploads}
        composeOnly
      />
    </div>
  );
}
