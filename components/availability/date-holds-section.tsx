"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Calendar, Check, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

import {
  createHoldAction,
  releaseHoldAction,
} from "@/app/(app)/availability/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate, HOLD_STATUS_LABEL } from "@/lib/availability/constants";
import type { DateHold, DateHoldInput } from "@/lib/availability/types";
import type { VenueSpace } from "@/lib/availability/types";

export function DateHoldsSection({
  leadId,
  leadName,
  initialHolds,
  spaces,
}: {
  leadId: string;
  leadName: string;
  initialHolds: DateHold[];
  spaces: VenueSpace[];
}) {
  const router = useRouter();
  const [holds, setHolds] = React.useState(initialHolds);
  const [showForm, setShowForm] = React.useState(false);
  const [holdDate, setHoldDate] = React.useState("");
  const [holdTitle, setHoldTitle] = React.useState(`Hold — ${leadName}`);
  const [spaceId, setSpaceId] = React.useState("");
  const [expiresAt, setExpiresAt] = React.useState("");
  const [addPending, startAdd] = React.useTransition();
  const [releasingId, setReleasingId] = React.useState<string | null>(null);

  function handleAdd() {
    if (!holdDate || !holdTitle.trim()) return;
    startAdd(async () => {
      const input: DateHoldInput = {
        leadId, spaceId, title: holdTitle.trim(), holdDate,
        startTime: "", endTime: "", notes: "",
        expiresAt: expiresAt ? new Date(expiresAt + "T23:59:59").toISOString() : "",
      };
      const result = await createHoldAction(input);
      if (result.ok) {
        toast.success("Hold placed.");
        setHolds((p) => [...p, { id: result.holdId, venueId: "", leadId, spaceId: spaceId || null, title: holdTitle.trim(), holdDate, startTime: null, endTime: null, status: "active", expiresAt: expiresAt || null, notes: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), leadName, spaceName: spaces.find((s) => s.id === spaceId)?.name ?? null }]);
        setShowForm(false);
        router.refresh();
      } else toast.error(result.message ?? "Could not place hold.");
    });
  }

  async function handleRelease(holdId: string) {
    setReleasingId(holdId);
    const result = await releaseHoldAction(holdId);
    setReleasingId(null);
    if (result.ok) {
      setHolds((p) => p.map((h) => h.id === holdId ? { ...h, status: "released" as const } : h));
      toast.success("Hold released.");
      router.refresh();
    } else toast.error(result.message ?? "Could not release hold.");
  }

  const activeHolds = holds.filter((h) => h.status === "active");
  const pastHolds = holds.filter((h) => h.status !== "active");

  return (
    <div className="space-y-3">
      {/* Active holds */}
      {activeHolds.length > 0 && (
        <div className="space-y-2">
          {activeHolds.map((hold) => (
            <div key={hold.id} className="group flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2.5">
              <Calendar className="h-4 w-4 shrink-0 text-warning-foreground mt-0.5" />
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-sm font-medium text-foreground">{formatDate(hold.holdDate)}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {hold.spaceName && <span>{hold.spaceName}</span>}
                  {hold.expiresAt && <span>Expires {new Date(hold.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
                </div>
              </div>
              <Button type="button" variant="ghost" size="sm" className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground"
                disabled={releasingId === hold.id} onClick={() => handleRelease(hold.id)}>
                {releasingId === hold.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                Release
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Past holds (collapsed) */}
      {pastHolds.length > 0 && (
        <div className="space-y-1">
          {pastHolds.map((hold) => (
            <div key={hold.id} className="flex items-center gap-2 px-1 py-0.5 text-xs text-muted-foreground">
              <Check className="h-3 w-3 shrink-0" />
              <span>{formatDate(hold.holdDate)} — {HOLD_STATUS_LABEL[hold.status]}</span>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {showForm ? (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Hold title</Label>
              <Input value={holdTitle} onChange={(e) => setHoldTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Hold date *</Label>
              <Input type="date" value={holdDate} onChange={(e) => setHoldDate(e.target.value)} />
            </div>
            {spaces.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Space <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <select value={spaceId} onChange={(e) => setSpaceId(e.target.value)}
                  className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="">Any / Whole venue</option>
                  {spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Auto-release date <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)} disabled={addPending}>Cancel</Button>
            <Button type="button" size="sm" disabled={!holdDate || !holdTitle.trim() || addPending} onClick={handleAdd}>
              {addPending ? "Placing…" : "Place Hold"}
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Place Hold
        </Button>
      )}
    </div>
  );
}
