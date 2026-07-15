"use client";

/**
 * Recommending vendors to a specific client — a distinct fact from
 * operationally assigning a vendor to work the event (EventVendorsSection,
 * below this on the same tab). A recommendation is "here are options for
 * the couple to consider," made before any decision; any number of vendors
 * can be recommended, even within the same category (three florist options
 * is the point). Selected vendors automatically appear in the client
 * portal (Vendor Management — Next Iteration, 2026-07-10).
 */

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { recommendVendorAction, unrecommendVendorAction } from "@/app/(app)/events/[id]/vendor-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSyncedState } from "@/lib/hooks/use-synced-state";
import { vendorCategoryLabel } from "@/lib/vendors/constants";
import type { EventVendorRecommendation } from "@/lib/vendor-recommendations/types";
import type { Vendor } from "@/lib/vendors/types";

export function EventVendorRecommendationsSection({
  eventId,
  clientName,
  initialRecommendations,
  vendorLibrary,
}: {
  eventId: string;
  clientName: string | null;
  initialRecommendations: EventVendorRecommendation[];
  vendorLibrary: Vendor[];
}) {
  const router = useRouter();
  // See lib/hooks/use-synced-state.ts.
  const [recommendations, setRecommendations] = useSyncedState(initialRecommendations);
  const [showForm, setShowForm] = React.useState(false);
  const [vendorId, setVendorId] = React.useState("");
  const [note, setNote] = React.useState("");
  const [addPending, startAdd] = React.useTransition();
  const [removingId, setRemovingId] = React.useState<string | null>(null);

  const recommendedIds = new Set(recommendations.map((r) => r.vendorId));
  const available = vendorLibrary.filter((v) => !recommendedIds.has(v.id));

  function handleAdd() {
    if (!vendorId) return;
    startAdd(async () => {
      const result = await recommendVendorAction(eventId, vendorId, note.trim() || null);
      if (result.ok) { setVendorId(""); setNote(""); setShowForm(false); router.refresh(); }
      else toast.error(result.message ?? "Could not recommend vendor.");
    });
  }

  async function handleRemove(recommendationId: string) {
    setRemovingId(recommendationId);
    const result = await unrecommendVendorAction(recommendationId, eventId);
    setRemovingId(null);
    if (result.ok) { setRecommendations((p) => p.filter((r) => r.id !== recommendationId)); }
    else toast.error(result.message ?? "Could not remove recommendation.");
  }

  return (
    <div className="space-y-4">
      {recommendations.length === 0 && !showForm && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No vendors recommended yet. Choose vendors from your Library to suggest to {clientName || "this client"} — they&apos;ll see them in their portal.
        </p>
      )}

      {recommendations.length > 0 && (
        <div className="space-y-2">
          {recommendations.map((r) => (
            <div key={r.id} className="group flex items-center gap-3 rounded-lg border border-border bg-card p-3">
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/vendors/${r.vendorId}`} className="text-sm font-medium text-foreground hover:text-primary">
                    {r.vendorName}
                  </Link>
                  {r.vendorCategory && <span className="text-xs text-muted-foreground">{vendorCategoryLabel(r.vendorCategory)}</span>}
                  {r.selectedAt && (
                    <Badge variant="success" className="text-[10px] flex items-center gap-1">
                      <Check className="h-3 w-3" /> Chosen by {clientName || "client"}
                    </Badge>
                  )}
                </div>
                {r.note && <p className="text-xs italic text-muted-foreground">{r.note}</p>}
              </div>
              <button
                type="button" onClick={() => handleRemove(r.id)} disabled={removingId === r.id}
                className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                aria-label="Remove recommendation"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Vendor from your Library</label>
            <Select
              value={vendorId} onValueChange={setVendorId}
              items={available.map((v) => ({ value: v.id, label: `${v.businessName}${v.category ? ` · ${vendorCategoryLabel(v.category)}` : ""}` }))}
            >
              <SelectTrigger><SelectValue placeholder="Select a vendor…" /></SelectTrigger>
              <SelectContent>
                {available.length === 0 && <SelectItem value="__none__" disabled>All vendors already recommended</SelectItem>}
                {available.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.businessName}{v.category ? ` · ${vendorCategoryLabel(v.category)}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Note to the client <span className="font-normal text-muted-foreground">(optional)</span></label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Our top pick for garden-style arrangements" />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => { setShowForm(false); setVendorId(""); setNote(""); }}>Cancel</Button>
            <Button type="button" size="sm" disabled={!vendorId || addPending} onClick={handleAdd}>
              {addPending ? "Recommending…" : "Recommend"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Recommend a Vendor
          </Button>
          {vendorLibrary.length === 0 && (
            <p className="text-xs text-muted-foreground">
              <Link href="/vendors/new" className="font-medium text-primary hover:underline">Add vendors to your Library</Link> first.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
