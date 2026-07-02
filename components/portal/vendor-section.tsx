"use client";

import * as React from "react";
import { ExternalLink, Mail } from "lucide-react";

import { VENDOR_CATEGORIES, vendorCategoryLabel } from "@/lib/vendors/constants";
import type { PortalVendor } from "@/lib/vendors/types";

// ── Recommendation logic ──────────────────────────────────────────────────────

function recommendedCategories(days: number | null): string[] {
  if (days === null || days >= 365) return ["photographer", "videographer", "officiant"];
  if (days >= 270) return ["photographer", "florist", "caterer"];
  if (days >= 180) return ["florist", "music", "hair_makeup"];
  if (days >= 90)  return ["music", "transportation", "cake"];
  if (days >= 30)  return ["transportation", "decor", "photo_booth"];
  return ["transportation", "decor", "other"];
}

function recommendedReason(days: number | null): string {
  if (days === null || days >= 365) return "12+ months out — lock in your photographer early, they book fast.";
  if (days >= 270) return "9 months out — most couples are booking florists and caterers now.";
  if (days >= 180) return "6 months out — music, hair & makeup, and officiant if you haven't yet.";
  if (days >= 90)  return "3 months out — transportation, cake tastings, final details.";
  if (days >= 30)  return "One month to go — confirm everyone's logistics and arrival times.";
  return "Almost time — verify all vendor confirmations and timelines.";
}

// ── Pricing badge ─────────────────────────────────────────────────────────────

function PricingBadge({ tier }: { tier: string | null }) {
  if (!tier) return null;
  const labels: Record<string, string> = { budget: "$", moderate: "$$", luxury: "$$$" };
  const colors: Record<string, string> = {
    budget:   "bg-emerald-50 text-emerald-700",
    moderate: "bg-amber-50 text-amber-700",
    luxury:   "bg-purple-50 text-purple-700",
  };
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${colors[tier] ?? "bg-muted text-muted-foreground"}`}>
      {labels[tier] ?? tier}
    </span>
  );
}

// ── Preference badge ──────────────────────────────────────────────────────────

function PreferenceBadge({ level }: { level: string }) {
  if (level === "recommended") return null;
  const cfg = level === "featured"
    ? { label: "⭐ Featured", cls: "bg-amber-50 text-amber-700 border-amber-200" }
    : { label: "✓ Preferred", cls: "bg-[#5D6F5D]/10 text-[#3D5040] border-[#5D6F5D]/20" };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ── Category emoji map ────────────────────────────────────────────────────────

const CATEGORY_EMOJI: Record<string, string> = {
  photographer: "📷", videographer: "🎬", florist: "💐", music: "🎵",
  caterer: "🍽", hair_makeup: "💄", officiant: "💍", transportation: "🚗",
  cake: "🎂", decor: "✨", photo_booth: "📸", other: "⭐",
};

// ── Vendor card ───────────────────────────────────────────────────────────────

function VendorCard({ vendor }: { vendor: PortalVendor }) {
  const emoji = CATEGORY_EMOJI[vendor.category ?? "other"] ?? "⭐";

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      {/* Photo or placeholder */}
      <div className="h-40 bg-muted flex items-center justify-center text-4xl shrink-0"
        style={vendor.photoUrl ? { backgroundImage: `url(${vendor.photoUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}>
        {!vendor.photoUrl && emoji}
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-sm leading-tight">{vendor.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{vendorCategoryLabel(vendor.category)}</p>
          </div>
          <PricingBadge tier={vendor.pricingTier} />
        </div>

        {vendor.preferenceLevel !== "recommended" && (
          <PreferenceBadge level={vendor.preferenceLevel} />
        )}

        {vendor.description && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
            {vendor.description}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-auto pt-2">
          {vendor.websiteUrl && (
            <a href={vendor.websiteUrl.startsWith("http") ? vendor.websiteUrl : `https://${vendor.websiteUrl}`}
              target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 px-3 rounded-lg bg-[#5D6F5D] text-white hover:bg-[#4A5C4A] transition-colors">
              <ExternalLink className="h-3 w-3" />
              Visit
            </a>
          )}
          {vendor.email && (
            <a href={`mailto:${vendor.email}`}
              className="flex items-center justify-center h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <Mail className="h-3.5 w-3.5" />
            </a>
          )}
          {vendor.instagramUrl && (
            <a href={vendor.instagramUrl.startsWith("http") ? vendor.instagramUrl : `https://${vendor.instagramUrl}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-[11px] font-bold">
              IG
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main section ──────────────────────────────────────────────────────────────

export function VendorSection({ token }: { token: string }) {
  const [vendors, setVendors] = React.useState<PortalVendor[]>([]);
  const [daysUntil, setDaysUntil] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [activeCategory, setActiveCategory] = React.useState<string>("all");

  React.useEffect(() => {
    fetch(`/api/portal/vendors?token=${token}`)
      .then(r => r.json())
      .then((d: { vendors?: PortalVendor[]; daysUntilWedding?: number | null }) => {
        setVendors(d.vendors ?? []);
        setDaysUntil(d.daysUntilWedding ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-muted-foreground">Loading vendor recommendations…</p>
      </div>
    );
  }

  if (!vendors.length) {
    return (
      <div className="py-16 text-center space-y-2 max-w-sm mx-auto px-4">
        <p className="text-3xl">🤝</p>
        <p className="font-semibold text-heading">Vendor recommendations coming soon</p>
        <p className="text-sm text-muted-foreground">Your venue is adding their preferred vendors. Check back soon for photographer, florist, and music recommendations curated for your wedding.</p>
      </div>
    );
  }

  const recCats = recommendedCategories(daysUntil);
  const reason = recommendedReason(daysUntil);

  // "Recommended for you": featured vendors + preferred in recommended categories
  const highlighted = vendors.filter(v =>
    v.preferenceLevel === "featured" ||
    (v.preferenceLevel === "preferred" && recCats.includes(v.category ?? ""))
  );

  // Categories that actually have vendors
  const usedCategories = [...new Set(vendors.map(v => v.category).filter(Boolean))] as string[];
  const categoryOptions = VENDOR_CATEGORIES.filter(c => usedCategories.includes(c.value));

  // Filtered list for Browse section
  const filtered = activeCategory === "all"
    ? vendors
    : vendors.filter(v => v.category === activeCategory);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-8">

      {/* Recommended for You */}
      {highlighted.length > 0 && (
        <section>
          <div className="mb-3">
            <p className="font-semibold text-heading">Recommended for You</p>
            <p className="text-xs text-muted-foreground mt-0.5">{reason}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {highlighted.map(v => <VendorCard key={v.id} vendor={v} />)}
          </div>
        </section>
      )}

      {/* Browse all vendors */}
      <section>
        <p className="font-semibold text-heading mb-3">
          {highlighted.length > 0 ? "All Vendors" : "Your Venue's Preferred Vendors"}
        </p>

        {/* Category filter */}
        {categoryOptions.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <button
              onClick={() => setActiveCategory("all")}
              className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                activeCategory === "all"
                  ? "bg-[#5D6F5D] text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}>
              All
            </button>
            {categoryOptions.map(c => (
              <button key={c.value}
                onClick={() => setActiveCategory(c.value)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                  activeCategory === c.value
                    ? "bg-[#5D6F5D] text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}>
                {c.label}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(v => <VendorCard key={v.id} vendor={v} />)}
        </div>
      </section>
    </div>
  );
}
