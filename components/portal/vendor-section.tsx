"use client";

/**
 * Vendors recommended specifically for this couple's event — not the
 * venue's whole directory (Vendor Management — Next Iteration, 2026-07-10).
 * A couple can view info, visit the website, call, email, check socials,
 * and choose a vendor — their venue sees the choice immediately, with no
 * duplicate entry or email required (the portal session already knows who
 * they are).
 */

import * as React from "react";
import { ExternalLink, Mail, Phone, Check } from "lucide-react";
import { toast } from "sonner";

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
  rec, onSelect, selecting,
}: { rec: PortalVendorRecommendation; onSelect: () => void; selecting: boolean }) {
  const emoji = CATEGORY_EMOJI[rec.category ?? "other"] ?? "⭐";
  const isSelected = !!rec.selectedAt;

  return (
    <div className={`bg-card border rounded-2xl overflow-hidden flex flex-col transition-shadow ${isSelected ? "border-[#5D6F5D] shadow-md" : "border-border hover:shadow-md"}`}>
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
          {isSelected && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-[#3D5040] bg-[#5D6F5D]/10 border border-[#5D6F5D]/20 rounded-full px-2 py-0.5 shrink-0">
              <Check className="h-3 w-3" /> Chosen
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
          onClick={onSelect}
          disabled={isSelected || selecting}
          className={`mt-auto pt-2 w-full text-xs font-medium py-2 px-3 rounded-lg transition-colors ${
            isSelected
              ? "bg-[#5D6F5D]/10 text-[#3D5040] cursor-default"
              : "bg-[#5D6F5D] text-white hover:bg-[#4A5C4A] disabled:opacity-60"
          }`}
        >
          {isSelected ? "This is your choice" : selecting ? "Saving…" : "Choose this vendor"}
        </button>
      </div>
    </div>
  );
}

export function VendorSection({ token, clientId }: { token: string; clientId: string }) {
  const [recommendations, setRecommendations] = React.useState<PortalVendorRecommendation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectingId, setSelectingId] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    fetch(`/api/portal/vendors?token=${token}&clientId=${clientId}`)
      .then((r) => r.json())
      .then((d: { recommendations?: PortalVendorRecommendation[] }) => setRecommendations(d.recommendations ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, clientId]);

  React.useEffect(() => { load(); }, [load]);

  async function handleSelect(recommendationId: string) {
    setSelectingId(recommendationId);
    try {
      const res = await fetch("/api/portal/vendors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, clientId, recommendationId }),
      });
      const data = await res.json() as { ok?: boolean };
      if (data.ok) {
        setRecommendations((prev) => prev.map((r) => r.id === recommendationId ? { ...r, selectedAt: new Date().toISOString() } : r));
        toast.success("Your choice has been saved — your venue can see it now.");
      } else {
        toast.error("Couldn't save your choice. Please try again.");
      }
    } catch {
      toast.error("Couldn't save your choice. Please try again.");
    } finally {
      setSelectingId(null);
    }
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

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div>
        <p className="font-semibold text-heading">Recommended for your event</p>
        <p className="text-xs text-muted-foreground mt-0.5">Vendors your venue suggests — view their info, reach out, and choose the ones you&apos;d like to work with.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {recommendations.map((r) => (
          <VendorCard key={r.id} rec={r} onSelect={() => handleSelect(r.id)} selecting={selectingId === r.id} />
        ))}
      </div>
    </div>
  );
}
