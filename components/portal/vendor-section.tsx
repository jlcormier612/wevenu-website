"use client";

/**
 * Vendors recommended specifically for this couple's event — not the
 * venue's whole directory (Vendor Management — Next Iteration, 2026-07-10).
 *
 * Commitment Alignment Sprint (docs/commitment-lifecycle-architecture.md
 * §9): picking a vendor is private — the couple can pick and unpick freely
 * while they compare options, and nothing is visible to the venue until
 * they explicitly submit their list. Submitting is a real Commitment: it
 * reveals the current picks to the venue, notifies them, and completes the
 * "Choose your vendors" Playbook task as a side effect.
 */

import * as React from "react";
import { ExternalLink, Mail, Phone, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { vendorCategoryLabel } from "@/lib/vendors/constants";

type PortalVendorRecommendation = {
  id: string;
  vendorId: string;
  name: string;
  category: string | null;
  description: string | null;
  photoUrl: string | null;
  websiteUrl: string | null;
  email: string | null;
  phone: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  pinterestUrl: string | null;
  tiktokUrl: string | null;
  note: string | null;
  pickedAt: string | null;
  selectedAt: string | null;
};

const CATEGORY_EMOJI: Record<string, string> = {
  photographer: "📷", videographer: "🎬", florist: "💐", music: "🎵",
  caterer: "🍽", hair_makeup: "💄", officiant: "💍", transportation: "🚗",
  cake: "🎂", decor: "✨", photo_booth: "📸", other: "⭐",
};

function socialLink(url: string | null) {
  if (!url) return null;
  return url.startsWith("http") ? url : `https://${url}`;
}

function VendorCard({
  rec, onToggle, toggling,
}: { rec: PortalVendorRecommendation; onToggle: (picked: boolean) => void; toggling: boolean }) {
  const emoji = CATEGORY_EMOJI[rec.category ?? "other"] ?? "⭐";
  const isSubmitted = !!rec.selectedAt;
  const isPicked = !!rec.pickedAt;

  return (
    <div className={`bg-card border rounded-2xl overflow-hidden flex flex-col transition-shadow ${isSubmitted ? "border-[var(--venue-primary)] shadow-md" : isPicked ? "border-[color-mix(in_srgb,var(--venue-primary)_50%,transparent)]" : "border-border hover:shadow-md"}`}>
      <div className="h-40 bg-muted flex items-center justify-center text-4xl shrink-0"
        style={rec.photoUrl ? { backgroundImage: `url(${rec.photoUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}>
        {!rec.photoUrl && emoji}
      </div>

      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-sm leading-tight">{rec.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{vendorCategoryLabel(rec.category)}</p>
          </div>
          {isSubmitted ? (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-[var(--venue-primary)] bg-[color-mix(in_srgb,var(--venue-primary)_10%,transparent)] border border-[color-mix(in_srgb,var(--venue-primary)_20%,transparent)] rounded-full px-2 py-0.5 shrink-0">
              <Check className="h-3 w-3" /> Chosen
            </span>
          ) : isPicked && (
            <span className="text-[10px] font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5 shrink-0">
              Picked — not sent yet
            </span>
          )}
        </div>

        {rec.note && (
          <p className="text-xs text-primary bg-primary/5 rounded-md px-2 py-1">{rec.note}</p>
        )}

        {rec.description && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{rec.description}</p>
        )}

        {/* View info / contact actions */}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          {rec.websiteUrl && (
            <a href={socialLink(rec.websiteUrl)!} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Visit website">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          {rec.phone && (
            <a href={`tel:${rec.phone}`}
              className="flex items-center justify-center h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Call">
              <Phone className="h-3.5 w-3.5" />
            </a>
          )}
          {rec.email && (
            <a href={`mailto:${rec.email}`}
              className="flex items-center justify-center h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Email">
              <Mail className="h-3.5 w-3.5" />
            </a>
          )}
          {rec.instagramUrl && (
            <a href={socialLink(rec.instagramUrl)!} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-[10px] font-bold" title="Instagram">
              IG
            </a>
          )}
          {rec.facebookUrl && (
            <a href={socialLink(rec.facebookUrl)!} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-[10px] font-bold" title="Facebook">
              FB
            </a>
          )}
          {rec.pinterestUrl && (
            <a href={socialLink(rec.pinterestUrl)!} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-[10px] font-bold" title="Pinterest">
              P
            </a>
          )}
          {rec.tiktokUrl && (
            <a href={socialLink(rec.tiktokUrl)!} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-[10px] font-bold" title="TikTok">
              TT
            </a>
          )}
        </div>

        <button
          type="button"
          onClick={() => onToggle(!isPicked)}
          disabled={toggling}
          className={`mt-auto pt-2 w-full text-xs font-medium py-2 px-3 rounded-lg transition-colors ${
            isPicked
              ? "bg-[color-mix(in_srgb,var(--venue-primary)_10%,transparent)] text-[var(--venue-primary)] hover:bg-[color-mix(in_srgb,var(--venue-primary)_20%,transparent)]"
              : "bg-[var(--venue-primary)] text-white hover:bg-[var(--venue-secondary)] disabled:opacity-60"
          }`}
        >
          {toggling ? "Saving…" : isPicked ? (isSubmitted ? "Unpick (will remove on next submit)" : "Unpick") : "Pick this vendor"}
        </button>
      </div>
    </div>
  );
}

export function VendorSection({ token, clientId }: { token: string; clientId: string }) {
  const [recommendations, setRecommendations] = React.useState<PortalVendorRecommendation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [confirmingSubmit, setConfirmingSubmit] = React.useState(false);

  const load = React.useCallback(() => {
    fetch(`/api/portal/vendors?token=${token}&clientId=${clientId}`)
      .then((r) => r.json())
      .then((d: { recommendations?: PortalVendorRecommendation[] }) => setRecommendations(d.recommendations ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, clientId]);

  React.useEffect(() => { load(); }, [load]);

  async function handleToggle(recommendationId: string, picked: boolean) {
    setTogglingId(recommendationId);
    try {
      const res = await fetch("/api/portal/vendors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, clientId, recommendationId, picked }),
      });
      const data = await res.json() as { ok?: boolean };
      if (data.ok) {
        setRecommendations((prev) => prev.map((r) => r.id === recommendationId ? { ...r, pickedAt: picked ? new Date().toISOString() : null } : r));
      } else {
        toast.error("Couldn't save your pick. Please try again.");
      }
    } catch {
      toast.error("Couldn't save your pick. Please try again.");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/portal/vendors/submit", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, clientId }),
      });
      const data = await res.json() as { ok?: boolean; selectedCount?: number };
      if (data.ok) {
        toast.success("🎉 Your vendor list is submitted — your venue can see it now.");
        setConfirmingSubmit(false);
        load();
      } else {
        toast.error("Couldn't submit your vendor list. Please try again.");
      }
    } finally { setSubmitting(false); }
  }

  if (loading) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-muted-foreground">Loading your recommended vendors…</p>
      </div>
    );
  }

  if (!recommendations.length) {
    return (
      <div className="py-16 text-center space-y-2 max-w-sm mx-auto px-4">
        <p className="text-3xl">🤝</p>
        <p className="font-semibold text-heading">No vendors recommended yet</p>
        <p className="text-sm text-muted-foreground">Your venue will add vendor recommendations here as they get to know your event.</p>
      </div>
    );
  }

  // Commitment Lifecycle Architecture §9 — picks are private until this
  // count reflects something worth reviewing and submitting.
  const pendingCount = recommendations.filter((r) => !!r.pickedAt !== !!r.selectedAt).length;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div>
        <p className="font-semibold text-heading">Recommended for your event</p>
        <p className="text-xs text-muted-foreground mt-0.5">Vendors your venue suggests — view their info, reach out, and pick the ones you&apos;d like to work with. Your picks stay private until you submit.</p>
      </div>

      {pendingCount > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
          {!confirmingSubmit ? (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm text-foreground">
                {pendingCount} pick{pendingCount === 1 ? "" : "s"} not yet sent to your venue.
              </p>
              <Button type="button" size="sm" onClick={() => setConfirmingSubmit(true)}>Submit Vendor List</Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-foreground">This becomes visible to your venue — continue?</p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" disabled={submitting} onClick={() => setConfirmingSubmit(false)}>Back</Button>
                <Button type="button" size="sm" disabled={submitting} onClick={handleSubmit}>
                  {submitting ? "Submitting…" : "Submit to Venue"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {recommendations.map((r) => (
          <VendorCard key={r.id} rec={r} onToggle={(picked) => handleToggle(r.id, picked)} toggling={togglingId === r.id} />
        ))}
      </div>
    </div>
  );
}
