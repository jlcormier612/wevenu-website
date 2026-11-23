"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { formatUsdFromCents } from "@shared/pricing/catalog";

type OfferRow = {
  id: string;
  status: string;
  internalName: string;
  planKey: string;
  revision: number;
  updatedAt: string;
  listAmountCents?: number;
  preview?: { monthlyRecurringCents?: number } | null;
};

type Props = {
  relationshipId: string;
  canManage: boolean;
};

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function SalesOffersSummary({ relationshipId, canManage }: Props) {
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/relationships/sales-offers?relationshipId=${encodeURIComponent(relationshipId)}`,
      );
      const data = (await res.json()) as {
        ok?: boolean;
        offers?: OfferRow[];
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.error || "Could not load offers.");
        setOffers([]);
        return;
      }
      setOffers((data.offers || []).filter((o) => o.status !== "discarded"));
    } catch {
      setError("Could not load offers.");
    } finally {
      setLoading(false);
    }
  }, [relationshipId]);

  useEffect(() => {
    if (canManage) void load();
    else setLoading(false);
  }, [canManage, load]);

  if (!canManage) return null;

  return (
    <section
      className="ws-panel mt-6 p-5"
      data-testid="sales-offers-summary"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="ws-eyebrow">Custom Offers</p>
          <h2 className="mt-1 font-heading text-xl text-[var(--htc-forest)]">
            Saved offers
          </h2>
          <p className="mt-1 text-sm ws-muted">
            Draft and review custom offers on a dedicated builder page. Standard
            subscription sending stays separate.
          </p>
        </div>
        <Link
          href={`/relationships/${relationshipId}/offers/new`}
          className="ws-btn-primary"
          data-testid="summary-create-custom-offer"
        >
          Create Custom Offer
        </Link>
      </div>

      {loading ? (
        <p className="mt-4 text-sm ws-muted">Loading offers…</p>
      ) : error ? (
        <p className="mt-4 text-sm text-[var(--htc-dusty)]">{error}</p>
      ) : offers.length === 0 ? (
        <p className="mt-4 text-sm ws-muted">
          No custom offers yet. Create one from Owner Actions when you need
          negotiated terms.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--htc-border)]" data-testid="sales-offers-list">
          {offers.map((offer) => (
            <li
              key={offer.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">
                  {offer.internalName}
                </p>
                <p className="mt-0.5 text-xs ws-muted">
                  {offer.status} · rev {offer.revision} · updated{" "}
                  {formatWhen(offer.updatedAt)}
                  {offer.preview?.monthlyRecurringCents != null
                    ? ` · ${formatUsdFromCents(offer.preview.monthlyRecurringCents)}/mo`
                    : offer.listAmountCents != null
                      ? ` · list ${formatUsdFromCents(offer.listAmountCents)}/mo`
                      : ""}
                </p>
              </div>
              <Link
                href={`/relationships/${relationshipId}/offers/${offer.id}`}
                className="text-sm text-[var(--htc-primary)] underline-offset-4 hover:underline"
              >
                {offer.status === "draft" ? "Open draft" : "Review"}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
