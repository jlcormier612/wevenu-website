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

type VendorPackage = { id: string; name: string; description: string | null; price: number | null; priceType: string };
type VendorFaq = { id: string; question: string; answer: string };

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
  // Program 4, Initiative C, Phase 8 (2026-07-23) — claimed-only fields;
  // null/[] when the vendor hasn't claimed their profile, so the venue's
  // own authored version (fields above) stays the complete experience.
  isClaimed: boolean;
  heroImageUrl: string | null;
  coverImageUrl: string | null;
  pricingTier: string | null;
  serviceArea: string | null;
  availabilityNotes: string | null;
  promotionHeadline: string | null;
  promotionDetails: string | null;
  packages: VendorPackage[];
  faqs: VendorFaq[];
};

const PRICING_TIER_LABEL: Record<string, string> = {
  budget: "$", mid_range: "$$", premium: "$$$", luxury: "$$$$",
};

function fmtPackagePrice(pkg: VendorPackage) {
  if (pkg.priceType === "contact") return "Contact for pricing";
  if (pkg.price == null) return "Contact for pricing";
  const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(pkg.price);
  return pkg.priceType === "starting_at" ? `Starting at ${amount}` : amount;
}

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
  const [expanded, setExpanded] = React.useState(false);
  const emoji = CATEGORY_EMOJI[rec.category ?? "other"] ?? "⭐";
  const isSubmitted = !!rec.selectedAt;
  const isPicked = !!rec.pickedAt;
  // Expanded gallery, for a claimed profile, is the vendor's own hero +
  // cover images layered over the card photo — the only real multi-image
  // fields this schema has (Phase 8: "Expanded gallery").
  const coverImage = rec.isClaimed ? (rec.coverImageUrl ?? rec.heroImageUrl ?? rec.photoUrl) : rec.photoUrl;
  const hasExpandedContent = rec.isClaimed && (
    rec.promotionHeadline || rec.packages.length > 0 || rec.faqs.length > 0 || rec.availabilityNotes || rec.heroImageUrl
  );

  return (
    <div className={`bg-card border rounded-2xl overflow-hidden flex flex-col transition-shadow ${isSubmitted ? "border-[var(--venue-primary)] shadow-md" : isPicked ? "border-[color-mix(in_srgb,var(--venue-primary)_50%,transparent)]" : "border-border hover:shadow-md"}`}>
      <div className="h-40 bg-muted flex items-center justify-center text-4xl shrink-0 relative"
        style={coverImage ? { backgroundImage: `url(${coverImage})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}>
        {!coverImage && emoji}
        {rec.isClaimed && (
          <span className="absolute top-2 left-2 text-[10px] font-semibold text-white bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5">
            ✓ Claimed profile
          </span>
        )}
      </div>

      {rec.isClaimed && rec.promotionHeadline && (
        <div className="px-4 pt-3 -mb-1">
          <p className="text-xs font-semibold px-2 py-1.5 rounded-lg bg-[color-mix(in_srgb,var(--venue-primary)_10%,transparent)] text-[var(--venue-primary)]">
            🎁 {rec.promotionHeadline}
          </p>
        </div>
      )}

      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-sm leading-tight">{rec.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {vendorCategoryLabel(rec.category)}
              {rec.isClaimed && rec.pricingTier && PRICING_TIER_LABEL[rec.pricingTier] && (
                <span className="ml-1.5 text-muted-foreground/70">{PRICING_TIER_LABEL[rec.pricingTier]}</span>
              )}
            </p>
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

        {hasExpandedContent && (
          <>
            <button type="button" onClick={() => setExpanded((v) => !v)}
              className="text-[11px] font-medium text-[var(--venue-primary)] hover:underline text-left">
              {expanded ? "Hide full profile" : "View full profile →"}
            </button>
            {expanded && (
              <div className="space-y-3 pt-1 border-t border-border/60 mt-1">
                {rec.promotionDetails && (
                  <p className="text-xs text-muted-foreground leading-relaxed pt-2">{rec.promotionDetails}</p>
                )}
                {rec.serviceArea && (
                  <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Service area:</span> {rec.serviceArea}</p>
                )}
                {rec.availabilityNotes && (
                  <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Availability:</span> {rec.availabilityNotes}</p>
                )}
                {rec.packages.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold text-foreground uppercase tracking-wide">Packages</p>
                    {rec.packages.map((pkg) => (
                      <div key={pkg.id} className="rounded-lg bg-muted/50 px-2.5 py-1.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-xs font-medium">{pkg.name}</span>
                          <span className="text-[11px] text-muted-foreground shrink-0">{fmtPackagePrice(pkg)}</span>
                        </div>
                        {pkg.description && <p className="text-[11px] text-muted-foreground mt-0.5">{pkg.description}</p>}
                      </div>
                    ))}
                  </div>
                )}
                {rec.faqs.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold text-foreground uppercase tracking-wide">FAQs</p>
                    {rec.faqs.map((faq) => (
                      <div key={faq.id}>
                        <p className="text-xs font-medium">{faq.question}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{faq.answer}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

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

export function VendorSection({ token, clientId, venueName }: { token: string; clientId: string; venueName: string }) {
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
      {/* Venue introduction — Program 4, Initiative D, Phase 7 (2026-07-23,
          refined 2026-07-23): "That instantly establishes trust." */}
      <div>
        <p className="font-semibold text-heading">These are the vendors {venueName} trusts and loves working with.</p>
        <p className="text-xs text-muted-foreground mt-0.5">View their info, reach out, and pick the ones you&apos;d like to work with. Your picks stay private until you submit.</p>
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

      {/* Grouped by category — "Florist / Photography / DJ / Cake /
          Planner etc." (2026-07-23). The RPC already sorts by category, so
          this just labels the groups rather than re-sorting. */}
      {Object.entries(
        recommendations.reduce<Record<string, PortalVendorRecommendation[]>>((acc, r) => {
          const key = r.category ?? "other";
          (acc[key] ??= []).push(r);
          return acc;
        }, {}),
      ).map(([category, recs]) => (
        <div key={category} className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {CATEGORY_EMOJI[category] ?? "⭐"} {vendorCategoryLabel(category)}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recs.map((r) => (
              <VendorCard key={r.id} rec={r} onToggle={(picked) => handleToggle(r.id, picked)} toggling={togglingId === r.id} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
