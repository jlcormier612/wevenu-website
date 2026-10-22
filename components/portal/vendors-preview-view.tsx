"use client";

/**
 * Read-only couple-facing Preferred Vendors browse (no pick/submit).
 * Presentation aligned with VendorSection recommendation cards.
 */

import { ExternalLink } from "lucide-react";

import { vendorCategoryLabel } from "@/lib/vendors/constants";

export type VendorPreviewCard = {
  id: string;
  vendorId: string;
  name: string;
  category: string | null;
  description: string | null;
  photoUrl: string | null;
  websiteUrl: string | null;
  note: string | null;
};

const CATEGORY_EMOJI: Record<string, string> = {
  photographer: "📷", videographer: "🎬", florist: "💐", music: "🎵",
  caterer: "🍽", hair_makeup: "💄", officiant: "💍", transportation: "🚗",
  cake: "🎂", decor: "✨", photo_booth: "📸", other: "⭐",
};

export function VendorsPortalPreviewView({
  recommendations,
  venueName,
}: {
  recommendations: VendorPreviewCard[];
  venueName: string;
}) {
  if (recommendations.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center" data-testid="vendors-portal-empty">
        <div className="text-3xl mb-3">🤝</div>
        <p className="text-sm font-medium text-heading">No preferred vendors yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          When {venueName} shares vendor recommendations for your event, they&apos;ll appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-4" data-testid="vendors-portal-view">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-heading">Recommended for you</h2>
        <p className="text-sm text-muted-foreground">
          Vendors {venueName} highlights for your celebration. Preview is view-only — couples pick and submit in their portal.
        </p>
      </div>
      <ul className="space-y-3">
        {recommendations.map((v) => {
          const emoji = CATEGORY_EMOJI[v.category ?? "other"] ?? "⭐";
          const cat = v.category ? vendorCategoryLabel(v.category) : null;
          return (
            <li
              key={v.id}
              className="rounded-xl border border-border bg-card overflow-hidden"
            >
              <div className="flex gap-3 p-4">
                <div className="h-14 w-14 shrink-0 rounded-lg bg-muted flex items-center justify-center overflow-hidden text-2xl">
                  {v.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.photoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    emoji
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-heading">{v.name}</p>
                  {cat ? <p className="text-xs text-muted-foreground">{cat}</p> : null}
                  {v.note ? <p className="text-xs text-muted-foreground mt-1">{v.note}</p> : null}
                  {v.description ? (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{v.description}</p>
                  ) : null}
                  {v.websiteUrl ? (
                    <a
                      href={v.websiteUrl.startsWith("http") ? v.websiteUrl : `https://${v.websiteUrl}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      Website <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
