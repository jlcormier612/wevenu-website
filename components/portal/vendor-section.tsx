"use client";

/**
 * Venue-preferred vendors for this couple's event.
 *
 * Tabs:
 *  - Recommended for You — venue-curated for this event (pick/submit)
 *  - All Our Vendors — full preferred directory (same pick/submit)
 *
 * Commitment Alignment: picks stay private (picked_at) until Submit, which
 * reveals selected_at to the venue, creates event_vendor_assignments
 * (venue↔vendor + couple↔vendor conversations + vendor email), and completes
 * the "Choose your vendors" task.
 *
 * Messaging: once assigned, couples open a dedicated couple↔vendor thread
 * from this section. Venue↔vendor ops stay separate.
 */

import * as React from "react";
import { ExternalLink, Mail, MessageSquare, Phone, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PortalCoupleVendorThread } from "@/components/portal/couple-vendor-thread";
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
  source?: string;
  pickedAt: string | null;
  selectedAt: string | null;
  isAssigned?: boolean;
  assignmentId?: string | null;
  coupleVendorConversationId?: string | null;
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

type PortalVendorDirectoryEntry = Omit<PortalVendorRecommendation, "note" | "id"> & {
  id: string; // relationship id
  preferenceLevel: string;
  recommendationId: string | null;
};

const PREFERENCE_BADGE: Record<string, string> = { featured: "⭐ Featured", preferred: "⭐ Preferred" };

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

type CardVendor = {
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
  note?: string | null;
  pickedAt: string | null;
  selectedAt: string | null;
  isAssigned?: boolean;
  coupleVendorConversationId?: string | null;
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
  preferenceLevel?: string;
};

function VendorCard({
  rec, onToggle, toggling, onMessage,
}: {
  rec: CardVendor;
  onToggle?: (picked: boolean) => void;
  toggling?: boolean;
  onMessage?: () => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const emoji = CATEGORY_EMOJI[rec.category ?? "other"] ?? "⭐";
  const isAssigned = !!rec.isAssigned;
  const isSubmitted = !!rec.selectedAt;
  const isPicked = !!rec.pickedAt;
  const preferenceBadge = rec.preferenceLevel ? PREFERENCE_BADGE[rec.preferenceLevel] : null;
  const coverImage = rec.isClaimed ? (rec.coverImageUrl ?? rec.heroImageUrl ?? rec.photoUrl) : rec.photoUrl;
  const hasExpandedContent = rec.isClaimed && (
    rec.promotionHeadline || rec.packages.length > 0 || rec.faqs.length > 0 || rec.availabilityNotes || rec.heroImageUrl
  );

  return (
    <div className={`bg-card border rounded-2xl overflow-hidden flex flex-col transition-shadow ${
      isAssigned
        ? "border-[var(--venue-primary)] shadow-md"
        : isSubmitted
          ? "border-[color-mix(in_srgb,var(--venue-primary)_60%,transparent)] shadow-sm"
          : isPicked
            ? "border-[color-mix(in_srgb,var(--venue-primary)_50%,transparent)]"
            : "border-border hover:shadow-md"
    }`}>
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
          {isAssigned ? (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-[var(--venue-primary)] bg-[color-mix(in_srgb,var(--venue-primary)_10%,transparent)] border border-[color-mix(in_srgb,var(--venue-primary)_20%,transparent)] rounded-full px-2 py-0.5 shrink-0">
              <Check className="h-3 w-3" /> On your team
            </span>
          ) : isSubmitted ? (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-[var(--venue-primary)] bg-[color-mix(in_srgb,var(--venue-primary)_10%,transparent)] border border-[color-mix(in_srgb,var(--venue-primary)_20%,transparent)] rounded-full px-2 py-0.5 shrink-0">
              <Check className="h-3 w-3" /> Chosen
            </span>
          ) : isPicked ? (
            <span className="text-[10px] font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5 shrink-0">
              Picked — not sent yet
            </span>
          ) : preferenceBadge && (
            <span className="text-[10px] font-medium text-[var(--venue-primary)] bg-[color-mix(in_srgb,var(--venue-primary)_10%,transparent)] rounded-full px-2 py-0.5 shrink-0">
              {preferenceBadge}
            </span>
          )}
        </div>

        {rec.note && (
          <p className="text-xs text-primary bg-primary/5 rounded-md px-2 py-1">{rec.note}</p>
        )}

        {rec.description && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{rec.description}</p>
        )}

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

        {onMessage && rec.isAssigned && rec.coupleVendorConversationId && (
          <button
            type="button"
            onClick={onMessage}
            className="mt-auto flex w-full items-center justify-center gap-1.5 rounded-lg border border-[color-mix(in_srgb,var(--venue-primary)_30%,transparent)] bg-[color-mix(in_srgb,var(--venue-primary)_8%,transparent)] py-2 px-3 text-xs font-medium text-[var(--venue-primary)] hover:bg-[color-mix(in_srgb,var(--venue-primary)_14%,transparent)]"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Message {rec.name}
          </button>
        )}

        {onToggle && (
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
        )}
      </div>
    </div>
  );
}

function SubmitBar({
  pendingCount, confirmingSubmit, submitting, onConfirm, onBack, onSubmit,
}: {
  pendingCount: number;
  confirmingSubmit: boolean;
  submitting: boolean;
  onConfirm: () => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  if (pendingCount <= 0) return null;
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
      {!confirmingSubmit ? (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-foreground">
            {pendingCount} pick{pendingCount === 1 ? "" : "s"} not yet sent to your venue.
          </p>
          <Button type="button" size="sm" onClick={onConfirm}>Submit Vendor List</Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-foreground">
            This submits your list to the venue and notifies the vendors you picked — continue?
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={submitting} onClick={onBack}>Back</Button>
            <Button type="button" size="sm" disabled={submitting} onClick={onSubmit}>
              {submitting ? "Submitting…" : "Submit to Venue"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function VendorSection({ token, clientId, venueName }: { token: string; clientId: string; venueName: string }) {
  const [recommendations, setRecommendations] = React.useState<PortalVendorRecommendation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [togglingKey, setTogglingKey] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [confirmingSubmit, setConfirmingSubmit] = React.useState(false);

  const [directory, setDirectory] = React.useState<PortalVendorDirectoryEntry[]>([]);
  const [directoryLoading, setDirectoryLoading] = React.useState(true);
  const [tab, setTab] = React.useState<"recommended" | "directory">("recommended");
  const [openThread, setOpenThread] = React.useState<{
    conversationId: string;
    vendorName: string;
  } | null>(null);

  const loadRecommendations = React.useCallback(() => {
    return fetch(`/api/portal/vendors?token=${token}&clientId=${clientId}`)
      .then((r) => r.json())
      .then((d: { recommendations?: PortalVendorRecommendation[] }) => setRecommendations(d.recommendations ?? []))
      .catch(() => {});
  }, [token, clientId]);

  const loadDirectory = React.useCallback(() => {
    return fetch(`/api/portal/vendors/directory?token=${token}&clientId=${clientId}`)
      .then((r) => r.json())
      .then((d: { vendors?: PortalVendorDirectoryEntry[] }) => setDirectory(d.vendors ?? []))
      .catch(() => {});
  }, [token, clientId]);

  const loadAll = React.useCallback(() => {
    return Promise.all([loadRecommendations(), loadDirectory()]);
  }, [loadRecommendations, loadDirectory]);

  React.useEffect(() => {
    loadRecommendations().finally(() => setLoading(false));
  }, [loadRecommendations]);

  React.useEffect(() => {
    loadDirectory().finally(() => setDirectoryLoading(false));
  }, [loadDirectory]);

  async function handleToggleRecommendation(recommendationId: string, vendorId: string, picked: boolean) {
    setTogglingKey(recommendationId);
    try {
      const res = await fetch("/api/portal/vendors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, clientId, recommendationId, picked }),
      });
      const data = await res.json() as { ok?: boolean };
      if (data.ok) {
        const pickedAt = picked ? new Date().toISOString() : null;
        setRecommendations((prev) => prev.map((r) => r.id === recommendationId ? { ...r, pickedAt } : r));
        setDirectory((prev) => prev.map((v) => v.vendorId === vendorId ? { ...v, pickedAt, recommendationId } : v));
      } else {
        toast.error("Couldn't save your pick. Please try again.");
      }
    } catch {
      toast.error("Couldn't save your pick. Please try again.");
    } finally {
      setTogglingKey(null);
    }
  }

  async function handleToggleDirectory(vendorId: string, picked: boolean) {
    setTogglingKey(`dir:${vendorId}`);
    try {
      const res = await fetch("/api/portal/vendors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, clientId, vendorId, picked }),
      });
      const data = await res.json() as { ok?: boolean; recommendationId?: string | null; pickedAt?: string | null };
      if (data.ok) {
        const pickedAt = picked ? (data.pickedAt ?? new Date().toISOString()) : null;
        setDirectory((prev) => prev.map((v) =>
          v.vendorId === vendorId
            ? { ...v, pickedAt, recommendationId: data.recommendationId ?? v.recommendationId }
            : v,
        ));
        // Venue-curated rows also live on Recommended — keep in sync.
        setRecommendations((prev) => {
          const exists = prev.some((r) => r.vendorId === vendorId);
          if (exists) {
            return prev.map((r) => r.vendorId === vendorId ? { ...r, pickedAt } : r);
          }
          return prev;
        });
      } else {
        toast.error("Couldn't save your pick. Please try again.");
      }
    } catch {
      toast.error("Couldn't save your pick. Please try again.");
    } finally {
      setTogglingKey(null);
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
        const n = data.selectedCount ?? 0;
        toast.success(
          n > 0
            ? `Your vendors are submitted — ${venueName} and the vendors have been notified.`
            : "Your vendor list is submitted — your venue can see it now.",
        );
        setConfirmingSubmit(false);
        await loadAll();
      } else {
        toast.error("Couldn't submit your vendor list. Please try again.");
      }
    } finally { setSubmitting(false); }
  }

  if (loading && directoryLoading) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-muted-foreground">Loading your vendors…</p>
      </div>
    );
  }

  // Unified pending across both tabs (directory drafts may not appear on Recommended yet).
  const pendingVendorIds = new Set<string>();
  for (const r of recommendations) {
    if (!!r.pickedAt !== !!r.selectedAt) pendingVendorIds.add(r.vendorId);
  }
  for (const v of directory) {
    if (!!v.pickedAt !== !!v.selectedAt) pendingVendorIds.add(v.vendorId);
  }
  const pendingCount = pendingVendorIds.size;

  const teamVendors = directory.filter((v) => v.isAssigned || v.selectedAt);
  // Prefer assignment list; fall back to selected from recommendations when directory empty.
  const teamFromRecs = recommendations.filter((r) => r.isAssigned || r.selectedAt);
  const teamList = teamVendors.length > 0 ? teamVendors : teamFromRecs;

  function groupByCategory<T extends { category: string | null }>(items: T[]) {
    return Object.entries(
      items.reduce<Record<string, T[]>>((acc, r) => {
        const key = r.category ?? "other";
        (acc[key] ??= []).push(r);
        return acc;
      }, {}),
    );
  }

  const submitBar = (
    <SubmitBar
      pendingCount={pendingCount}
      confirmingSubmit={confirmingSubmit}
      submitting={submitting}
      onConfirm={() => setConfirmingSubmit(true)}
      onBack={() => setConfirmingSubmit(false)}
      onSubmit={handleSubmit}
    />
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div>
        <p className="font-semibold text-heading">These are the vendors {venueName} trusts and loves working with.</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Pick from their recommendations or full vendor list. Your picks stay private until you submit —
          then the venue and those vendors are notified. Once a vendor is on your team, you can message them directly here.
        </p>
      </div>

      {openThread && (
        <PortalCoupleVendorThread
          token={token}
          clientId={clientId}
          conversationId={openThread.conversationId}
          vendorName={openThread.vendorName}
          onBack={() => setOpenThread(null)}
        />
      )}

      {teamList.length > 0 && (
        <div className="rounded-2xl border border-[color-mix(in_srgb,var(--venue-primary)_25%,transparent)] bg-[color-mix(in_srgb,var(--venue-primary)_6%,transparent)] p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--venue-primary)]">Your vendor team</p>
          <ul className="flex flex-wrap gap-2">
            {teamList.map((v) => (
              <li key={v.vendorId} className="flex items-center gap-1.5">
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-card border border-border text-foreground">
                  {v.name}
                  {v.isAssigned ? (
                    <span className="ml-1.5 text-muted-foreground">· booked</span>
                  ) : (
                    <span className="ml-1.5 text-muted-foreground">· chosen</span>
                  )}
                </span>
                {v.isAssigned && v.coupleVendorConversationId && (
                  <button
                    type="button"
                    onClick={() => setOpenThread({
                      conversationId: v.coupleVendorConversationId!,
                      vendorName: v.name,
                    })}
                    className="text-[11px] font-medium text-[var(--venue-primary)] hover:underline"
                  >
                    Message
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-1 border-b border-border">
        <button type="button" onClick={() => setTab("recommended")}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === "recommended" ? "border-[var(--venue-primary)] text-[var(--venue-primary)]" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          Recommended for You{recommendations.length > 0 && ` (${recommendations.length})`}
        </button>
        <button type="button" onClick={() => setTab("directory")}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === "directory" ? "border-[var(--venue-primary)] text-[var(--venue-primary)]" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          All Our Vendors{directory.length > 0 && ` (${directory.length})`}
        </button>
      </div>

      {tab === "recommended" && (
        <div className="space-y-6">
          {submitBar}
          {!recommendations.length ? (
            <div className="py-16 text-center space-y-3 max-w-sm mx-auto px-4">
              <p className="text-3xl">🤝</p>
              <p className="font-semibold text-heading">No vendors recommended yet</p>
              <p className="text-sm text-muted-foreground">Your venue will add recommendations here — or browse their full preferred list.</p>
              {directory.length > 0 && (
                <button type="button" onClick={() => setTab("directory")} className="text-sm font-medium text-[var(--venue-primary)] hover:underline">
                  Browse all {directory.length} of {venueName}&apos;s vendors →
                </button>
              )}
            </div>
          ) : (
            groupByCategory(recommendations).map(([category, recs]) => (
              <div key={category} className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {CATEGORY_EMOJI[category] ?? "⭐"} {vendorCategoryLabel(category)}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {recs.map((r) => (
                    <VendorCard
                      key={r.id}
                      rec={r}
                      onToggle={(picked) => handleToggleRecommendation(r.id, r.vendorId, picked)}
                      toggling={togglingKey === r.id}
                      onMessage={
                        r.coupleVendorConversationId
                          ? () => setOpenThread({
                              conversationId: r.coupleVendorConversationId!,
                              vendorName: r.name,
                            })
                          : undefined
                      }
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "directory" && (
        directoryLoading ? (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">Loading {venueName}&apos;s vendors…</p>
          </div>
        ) : !directory.length ? (
          <div className="py-16 text-center space-y-2 max-w-sm mx-auto px-4">
            <p className="text-3xl">🤝</p>
            <p className="font-semibold text-heading">No vendors listed yet</p>
            <p className="text-sm text-muted-foreground">Your venue hasn&apos;t added any preferred vendors here yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {submitBar}
            {groupByCategory(directory).map(([category, vendors]) => (
              <div key={category} className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {CATEGORY_EMOJI[category] ?? "⭐"} {vendorCategoryLabel(category)}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {vendors.map((v) => (
                    <VendorCard
                      key={v.id}
                      rec={{ ...v, note: null }}
                      onToggle={(picked) => handleToggleDirectory(v.vendorId, picked)}
                      toggling={togglingKey === `dir:${v.vendorId}`}
                      onMessage={
                        v.coupleVendorConversationId
                          ? () => setOpenThread({
                              conversationId: v.coupleVendorConversationId!,
                              vendorName: v.name,
                            })
                          : undefined
                      }
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
