"use client";

import * as React from "react";
import { Building2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { updateVenuePromotionAction } from "@/app/vendor/actions";
import type { VendorPartnership } from "@/lib/vendors/types";

const STATUS_LABELS: Record<string, string> = { active: "Active", invited: "Invited", inactive: "Inactive" };
const STATUS_VARIANTS: Record<string, "default" | "outline" | "secondary"> = {
  active: "default", invited: "outline", inactive: "secondary",
};
const PREFERENCE_LABELS: Record<string, string> = { featured: "Featured", preferred: "Preferred", recommended: "Recommended" };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Exported so the venue-first Dashboard's "Current Promotion" card
// (components/vendor-app/vendor-home.tsx) can reuse the exact same editor
// rather than a second copy of this logic.
export function PromotionEditor({ partnership }: { partnership: Pick<VendorPartnership, "id" | "promotionHeadline" | "promotionDetails"> }) {
  const [editing, setEditing] = React.useState(false);
  const [headline, setHeadline] = React.useState(partnership.promotionHeadline ?? "");
  const [details, setDetails] = React.useState(partnership.promotionDetails ?? "");
  const [saving, setSaving] = React.useState(false);

  // View mode reads local state, not the `partnership` prop directly — the
  // prop only refreshes on the next server render/navigation, which would
  // otherwise leave a just-saved promotion showing its old text until the
  // vendor reloads the page.
  const [savedHeadline, setSavedHeadline] = React.useState(partnership.promotionHeadline);

  async function handleSave() {
    setSaving(true);
    try {
      const result = await updateVenuePromotionAction(partnership.id, headline, details);
      if (result.ok) {
        toast.success("Promotion updated.");
        setSavedHeadline(headline.trim() || null);
        setEditing(false);
      } else {
        toast.error(result.message ?? "Couldn't save your promotion.");
      }
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="mt-3 pt-3 border-t border-border/60">
        {savedHeadline ? (
          <p className="text-xs font-medium text-foreground">🎁 {savedHeadline}</p>
        ) : (
          <p className="text-xs text-muted-foreground">No promotion set for this venue's couples yet.</p>
        )}
        <button type="button" onClick={() => setEditing(true)} className="text-[11px] font-medium text-primary hover:underline mt-1">
          {savedHeadline ? "Edit promotion" : "Add a promotion →"}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-border/60 space-y-2">
      <input
        value={headline}
        onChange={(e) => setHeadline(e.target.value)}
        placeholder="e.g. Book by Sept 1 for a free engagement session"
        maxLength={120}
        className="w-full text-xs rounded-lg border border-border px-2.5 py-1.5 bg-background"
      />
      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        placeholder="Details couples should know about this offer…"
        rows={2}
        maxLength={500}
        className="w-full text-xs rounded-lg border border-border px-2.5 py-1.5 bg-background resize-none"
      />
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={saving} onClick={handleSave} className="text-xs h-7">
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => {
          setEditing(false); setHeadline(partnership.promotionHeadline ?? ""); setDetails(partnership.promotionDetails ?? "");
        }} className="text-xs h-7">
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function VendorPartnershipsList({ partnerships }: { partnerships: VendorPartnership[] }) {
  if (partnerships.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-12 text-center">
        <Building2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">No venue partnerships yet</p>
        <p className="text-xs mt-1 text-muted-foreground">
          Venues will appear here once they add you to their preferred vendor list.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {partnerships.map((p) => (
        <div key={p.id} className="rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground border border-border overflow-hidden">
              {p.venueLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.venueLogoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                p.venueName.slice(0, 2).toUpperCase()
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{p.venueName}</p>
              <p className="text-xs text-muted-foreground">
                Partner since {formatDate(p.addedAt)}
                {p.activeEventCount > 0 && ` · ${p.activeEventCount} event${p.activeEventCount === 1 ? "" : "s"} together`}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <Badge variant={STATUS_VARIANTS[p.status] ?? "outline"} className="text-xs">{STATUS_LABELS[p.status] ?? p.status}</Badge>
              {PREFERENCE_LABELS[p.preferenceLevel] && (
                <span className="text-[10px] text-muted-foreground">{PREFERENCE_LABELS[p.preferenceLevel]}</span>
              )}
            </div>
          </div>
          <PromotionEditor partnership={p} />
        </div>
      ))}
    </div>
  );
}
