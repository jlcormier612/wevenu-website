"use client";

/**
 * Venue-preferred vendors for this couple's event.
 *
 * Tabs:
 *  - Recommended for You — venue-curated for this event (pick/submit)
 *  - All Our Vendors — full preferred directory (same pick/submit)
 *
 * Browse is a compact list; full profile opens as an in-section detail
 * view with Back (same swap pattern as Messages / couple↔vendor thread).
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
import { ArrowLeft, Check, ExternalLink, Mail, MessageSquare, Phone } from "lucide-react";
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
  contactName: string | null;
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
  contactName: string | null;
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

function StatusChip({ rec }: { rec: CardVendor }) {
  const isAssigned = !!rec.isAssigned;
  const isSubmitted = !!rec.selectedAt;
  const isPicked = !!rec.pickedAt;

  if (isAssigned) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--venue-primary)] bg-[color-mix(in_srgb,var(--venue-primary)_10%,transparent)] border border-[color-mix(in_srgb,var(--venue-primary)_20%,transparent)] rounded-full px-2 py-0.5 shrink-0">
        <Check className="h-3 w-3" /> On your team
      </span>
    );
  }
  if (isSubmitted) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--venue-primary)] bg-[color-mix(in_srgb,var(--venue-primary)_10%,transparent)] border border-[color-mix(in_srgb,var(--venue-primary)_20%,transparent)] rounded-full px-2 py-0.5 shrink-0">
        <Check className="h-3 w-3" /> Chosen
      </span>
    );
  }
  if (isPicked) {
    return (
      <span className="text-[10px] font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5 shrink-0">
        Picked
      </span>
    );
  }
  return null;
}

function VendorThumb({ rec }: { rec: CardVendor }) {
  const emoji = CATEGORY_EMOJI[rec.category ?? "other"] ?? "⭐";
  const thumb = rec.photoUrl ?? (rec.isClaimed ? (rec.heroImageUrl ?? rec.coverImageUrl) : null);

  return (
    <div
      className="h-12 w-12 shrink-0 rounded-xl bg-muted flex items-center justify-center overflow-hidden text-lg"
      style={thumb ? { backgroundImage: `url(${thumb})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
      aria-hidden
    >
      {!thumb && emoji}
    </div>
  );
}

function PickButton({
  rec, toggling, onToggle,
}: {
  rec: CardVendor;
  toggling?: boolean;
  onToggle?: (picked: boolean) => void;
}) {
  const isAssigned = !!rec.isAssigned;
  const isPicked = !!rec.pickedAt;
  const isSubmitted = !!rec.selectedAt;

  if (isAssigned && !isPicked && !isSubmitted) {
    return (
      <p className="text-[11px] text-muted-foreground leading-snug max-w-[9rem] text-right">
        Assigned — ask your venue to change
      </p>
    );
  }
  if (!onToggle) return null;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle(!isPicked);
      }}
      disabled={toggling}
      className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors disabled:opacity-60 ${
        isPicked
          ? "bg-[color-mix(in_srgb,var(--venue-primary)_10%,transparent)] text-[var(--venue-primary)] hover:bg-[color-mix(in_srgb,var(--venue-primary)_20%,transparent)]"
          : "text-white hover:opacity-90"
      }`}
      style={isPicked ? undefined : { background: "var(--venue-primary)" }}
    >
      {toggling ? "Saving…" : isPicked ? "Unpick" : "Pick"}
    </button>
  );
}

function VendorListRow({
  rec, onToggle, toggling, onView,
}: {
  rec: CardVendor;
  onToggle?: (picked: boolean) => void;
  toggling?: boolean;
  onView: () => void;
}) {
  const pricing = rec.pricingTier ? PRICING_TIER_LABEL[rec.pricingTier] : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onView}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onView();
        }
      }}
      className="flex w-full items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-3 text-left cursor-pointer hover:border-border transition-colors"
    >
      <VendorThumb rec={rec} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-heading truncate">{rec.name}</p>
          <StatusChip rec={rec} />
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {vendorCategoryLabel(rec.category)}
          {pricing && <span className="ml-1.5 text-muted-foreground/70">{pricing}</span>}
        </p>
        {rec.note && (
          <p className="text-[11px] text-primary mt-0.5 truncate">{rec.note}</p>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onView();
          }}
          className="text-[11px] font-medium text-[var(--venue-primary)] hover:underline mt-1"
        >
          View profile
        </button>
      </div>
      <PickButton rec={rec} toggling={toggling} onToggle={onToggle} />
    </div>
  );
}

function VendorDetail({
  rec, onBack, onToggle, toggling, onMessage,
}: {
  rec: CardVendor;
  onBack: () => void;
  onToggle?: (picked: boolean) => void;
  toggling?: boolean;
  onMessage?: () => void;
}) {
  const coverImage = rec.isClaimed
    ? (rec.coverImageUrl ?? rec.heroImageUrl ?? rec.photoUrl)
    : rec.photoUrl;
  const emoji = CATEGORY_EMOJI[rec.category ?? "other"] ?? "⭐";
  const pricing = rec.pricingTier ? PRICING_TIER_LABEL[rec.pricingTier] : null;
  const isAssigned = !!rec.isAssigned;
  const isPicked = !!rec.pickedAt;
  const isSubmitted = !!rec.selectedAt;
  const hasContact = !!(rec.contactName || rec.websiteUrl || rec.phone || rec.email
    || rec.instagramUrl || rec.facebookUrl || rec.pinterestUrl || rec.tiktokUrl);

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Preferred Vendors
      </button>

      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div
          className="h-44 bg-muted flex items-center justify-center text-4xl relative"
          style={coverImage ? { backgroundImage: `url(${coverImage})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
        >
          {!coverImage && emoji}
          {rec.isClaimed && (
            <span className="absolute top-3 left-3 text-[10px] font-semibold text-white bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5">
              ✓ Claimed profile
            </span>
          )}
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-heading text-base leading-tight">{rec.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {vendorCategoryLabel(rec.category)}
                {pricing && <span className="ml-1.5 text-muted-foreground/70">{pricing}</span>}
              </p>
            </div>
            <StatusChip rec={rec} />
          </div>

          {rec.promotionHeadline && (
            <p className="text-xs font-semibold px-2.5 py-2 rounded-lg bg-[color-mix(in_srgb,var(--venue-primary)_10%,transparent)] text-[var(--venue-primary)]">
              {rec.promotionHeadline}
            </p>
          )}

          {rec.note && (
            <p className="text-xs text-primary bg-primary/5 rounded-md px-2.5 py-1.5">{rec.note}</p>
          )}

          {rec.description && (
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{rec.description}</p>
          )}

          {rec.promotionDetails && (
            <p className="text-xs text-muted-foreground leading-relaxed">{rec.promotionDetails}</p>
          )}

          {rec.serviceArea && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Service area:</span> {rec.serviceArea}
            </p>
          )}
          {rec.availabilityNotes && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Availability:</span> {rec.availabilityNotes}
            </p>
          )}

          {rec.packages.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-foreground uppercase tracking-wide">Packages</p>
              {rec.packages.map((pkg) => (
                <div key={pkg.id} className="rounded-lg bg-muted/50 px-3 py-2">
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
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-foreground uppercase tracking-wide">FAQs</p>
              {rec.faqs.map((faq) => (
                <div key={faq.id}>
                  <p className="text-xs font-medium">{faq.question}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{faq.answer}</p>
                </div>
              ))}
            </div>
          )}

          {hasContact && (
            <div className="space-y-2 pt-1">
              <p className="text-[11px] font-semibold text-foreground uppercase tracking-wide">Contact</p>
              {rec.contactName && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Contact:</span> {rec.contactName}
                </p>
              )}
              {rec.websiteUrl && (
                <p className="text-xs">
                  <a href={socialLink(rec.websiteUrl)!} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[var(--venue-primary)] hover:underline break-all">
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    {rec.websiteUrl.replace(/^https?:\/\//, "")}
                  </a>
                </p>
              )}
              {rec.phone && (
                <p className="text-xs">
                  <a href={`tel:${rec.phone}`}
                    className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    {rec.phone}
                  </a>
                </p>
              )}
              {rec.email && (
                <p className="text-xs">
                  <a href={`mailto:${rec.email}`}
                    className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground break-all">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    {rec.email}
                  </a>
                </p>
              )}
              {(rec.instagramUrl || rec.facebookUrl || rec.pinterestUrl || rec.tiktokUrl) && (
                <div className="flex items-center gap-2 flex-wrap">
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
              )}
            </div>
          )}

          <div className="flex flex-col gap-2 pt-1">
            {onMessage && isAssigned && rec.coupleVendorConversationId && (
              <button
                type="button"
                onClick={onMessage}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[color-mix(in_srgb,var(--venue-primary)_30%,transparent)] bg-[color-mix(in_srgb,var(--venue-primary)_8%,transparent)] py-2.5 px-3 text-xs font-medium text-[var(--venue-primary)] hover:bg-[color-mix(in_srgb,var(--venue-primary)_14%,transparent)]"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Message {rec.name}
              </button>
            )}

            {isAssigned && !isPicked && !isSubmitted ? (
              <p className="text-xs text-center text-muted-foreground leading-relaxed py-1">
                Assigned — ask your venue to change
              </p>
            ) : onToggle ? (
              <button
                type="button"
                onClick={() => onToggle(!isPicked)}
                disabled={toggling}
                className={`w-full text-xs font-semibold py-2.5 px-3 rounded-xl transition-colors disabled:opacity-60 ${
                  isPicked
                    ? "bg-[color-mix(in_srgb,var(--venue-primary)_10%,transparent)] text-[var(--venue-primary)] hover:bg-[color-mix(in_srgb,var(--venue-primary)_20%,transparent)]"
                    : "text-white hover:opacity-90"
                }`}
                style={isPicked ? undefined : { background: "var(--venue-primary)" }}
              >
                {toggling ? "Saving…" : isPicked ? "Unpick" : "Pick this vendor"}
              </button>
            ) : null}
          </div>
        </div>
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
    <div className="sticky top-0 z-10 rounded-2xl border border-border bg-card/95 backdrop-blur-sm p-4 space-y-2 shadow-sm">
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

type ViewingVendor = {
  vendorId: string;
  source: "recommended" | "directory";
  recommendationId?: string;
};

export function VendorSection({ token, clientId, venueName }: { token: string; clientId: string; venueName: string }) {
  const [recommendations, setRecommendations] = React.useState<PortalVendorRecommendation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [togglingKey, setTogglingKey] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [confirmingSubmit, setConfirmingSubmit] = React.useState(false);

  const [directory, setDirectory] = React.useState<PortalVendorDirectoryEntry[]>([]);
  const [directoryLoading, setDirectoryLoading] = React.useState(true);
  const [tab, setTab] = React.useState<"recommended" | "directory">("recommended");
  const [viewing, setViewing] = React.useState<ViewingVendor | null>(null);
  const listScrollY = React.useRef(0);
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
      const data = await res.json() as {
        ok?: boolean;
        selectedCount?: number;
        removalRequests?: Array<{ requestId: string }> | string | null;
      };
      if (data.ok) {
        const n = data.selectedCount ?? 0;
        const removalCount = Array.isArray(data.removalRequests)
          ? data.removalRequests.length
          : typeof data.removalRequests === "string"
            ? (JSON.parse(data.removalRequests) as unknown[]).length
            : 0;
        if (removalCount > 0) {
          toast.success(
            n > 0
              ? `List updated — ${venueName} was asked to remove ${removalCount} vendor${removalCount === 1 ? "" : "s"} still assigned.`
              : `Submitted — ${venueName} was asked to remove ${removalCount} vendor${removalCount === 1 ? "" : "s"} still assigned.`,
          );
        } else {
          toast.success(
            n > 0
              ? `Your vendors are submitted — ${venueName} and the vendors have been notified.`
              : "Your vendor list is submitted — your venue can see it now.",
          );
        }
        setConfirmingSubmit(false);
        await loadAll();
      } else {
        toast.error("Couldn't submit your vendor list. Please try again.");
      }
    } finally { setSubmitting(false); }
  }

  function openVendor(next: ViewingVendor) {
    listScrollY.current = typeof window !== "undefined" ? window.scrollY : 0;
    setViewing(next);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }

  function closeVendor() {
    setViewing(null);
    requestAnimationFrame(() => {
      if (typeof window !== "undefined") window.scrollTo({ top: listScrollY.current });
    });
  }

  // Resolve live vendor data for the open detail (picks update in place).
  const viewingRec: CardVendor | null = (() => {
    if (!viewing) return null;
    if (viewing.source === "recommended") {
      const r = recommendations.find((x) => x.vendorId === viewing.vendorId);
      return r ?? null;
    }
    const v = directory.find((x) => x.vendorId === viewing.vendorId);
    return v ? { ...v, note: null } : null;
  })();

  React.useEffect(() => {
    if (viewing && !viewingRec) setViewing(null);
  }, [viewing, viewingRec]);

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

  if (openThread) {
    return (
      <div className="space-y-4">
        <PortalCoupleVendorThread
          token={token}
          clientId={clientId}
          conversationId={openThread.conversationId}
          vendorName={openThread.vendorName}
          onBack={() => setOpenThread(null)}
        />
      </div>
    );
  }

  if (viewing && viewingRec) {
    const toggleKey = viewing.source === "recommended" && viewing.recommendationId
      ? viewing.recommendationId
      : `dir:${viewing.vendorId}`;
    return (
      <VendorDetail
        rec={viewingRec}
        onBack={closeVendor}
        onToggle={
          viewing.source === "recommended" && viewing.recommendationId
            ? (picked) => handleToggleRecommendation(viewing.recommendationId!, viewing.vendorId, picked)
            : (picked) => handleToggleDirectory(viewing.vendorId, picked)
        }
        toggling={togglingKey === toggleKey}
        onMessage={
          viewingRec.coupleVendorConversationId
            ? () => setOpenThread({
                conversationId: viewingRec.coupleVendorConversationId!,
                vendorName: viewingRec.name,
              })
            : undefined
        }
      />
    );
  }

  return (
    <div id="portal-focus-vendors-pick" className="space-y-6">
      <div>
        <p className="font-semibold text-heading">These are the vendors {venueName} trusts and loves working with.</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Pick from their recommendations or full vendor list. Your picks stay private until you submit —
          then the venue and those vendors are notified. Once a vendor is on your team, you can message them directly here.
          If you change your mind after they&apos;re assigned, unpick and resubmit — your venue will be asked to update the assignment.
        </p>
      </div>

      {teamList.length > 0 && (
        <div className="rounded-2xl border border-[color-mix(in_srgb,var(--venue-primary)_25%,transparent)] bg-[color-mix(in_srgb,var(--venue-primary)_6%,transparent)] p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--venue-primary)]">Your vendor team</p>
          <ul className="flex flex-wrap gap-2">
            {teamList.map((v) => (
              <li key={v.vendorId} className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const inRecs = recommendations.some((r) => r.vendorId === v.vendorId);
                    const inDir = directory.some((d) => d.vendorId === v.vendorId);
                    if (tab === "directory" && inDir) {
                      openVendor({ vendorId: v.vendorId, source: "directory" });
                    } else if (inRecs) {
                      const r = recommendations.find((x) => x.vendorId === v.vendorId)!;
                      openVendor({ vendorId: v.vendorId, source: "recommended", recommendationId: r.id });
                    } else if (inDir) {
                      openVendor({ vendorId: v.vendorId, source: "directory" });
                    }
                  }}
                  className="text-xs font-medium px-2.5 py-1 rounded-full bg-card border border-border text-foreground hover:border-[color-mix(in_srgb,var(--venue-primary)_40%,transparent)]"
                >
                  {v.name}
                  {v.isAssigned ? (
                    <span className="ml-1.5 text-muted-foreground">· booked</span>
                  ) : (
                    <span className="ml-1.5 text-muted-foreground">· chosen</span>
                  )}
                </button>
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
          Preferred Vendors{directory.length > 0 && ` (${directory.length})`}
        </button>
      </div>

      {tab === "recommended" && (
        <div className="space-y-5">
          {submitBar}
          {!recommendations.length ? (
            <div className="py-16 text-center space-y-3 max-w-sm mx-auto px-4">
              <p className="text-3xl">🤝</p>
              <p className="font-semibold text-heading">No vendors recommended yet</p>
              <p className="text-sm text-muted-foreground">Your venue will add recommendations here — or browse their Preferred Vendors.</p>
              {directory.length > 0 && (
                <button type="button" onClick={() => setTab("directory")} className="text-sm font-medium text-[var(--venue-primary)] hover:underline">
                  Browse all {directory.length} Preferred Vendors →
                </button>
              )}
            </div>
          ) : (
            groupByCategory(recommendations).map(([category, recs]) => (
              <div key={category} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {CATEGORY_EMOJI[category] ?? "⭐"} {vendorCategoryLabel(category)}
                </p>
                <div className="space-y-2">
                  {recs.map((r) => (
                    <VendorListRow
                      key={r.id}
                      rec={r}
                      onToggle={(picked) => handleToggleRecommendation(r.id, r.vendorId, picked)}
                      toggling={togglingKey === r.id}
                      onView={() => openVendor({
                        vendorId: r.vendorId,
                        source: "recommended",
                        recommendationId: r.id,
                      })}
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
            <p className="text-sm text-muted-foreground">Your venue hasn&apos;t added any Preferred Vendors here yet.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {submitBar}
            {groupByCategory(directory).map(([category, vendors]) => (
              <div key={category} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {CATEGORY_EMOJI[category] ?? "⭐"} {vendorCategoryLabel(category)}
                </p>
                <div className="space-y-2">
                  {vendors.map((v) => (
                    <VendorListRow
                      key={v.id}
                      rec={{ ...v, note: null }}
                      onToggle={(picked) => handleToggleDirectory(v.vendorId, picked)}
                      toggling={togglingKey === `dir:${v.vendorId}`}
                      onView={() => openVendor({ vendorId: v.vendorId, source: "directory" })}
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
