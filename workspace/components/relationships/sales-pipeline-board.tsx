"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { AutoArrivalDot } from "@/components/relationships/auto-arrival-badge";
import { StatusPill } from "@/components/shared/ui";
import {
  SALES_STAGE_COLUMNS,
  SALES_STAGE_LABELS,
  countAutoArrivalsForStage,
  deriveSalesStage,
  type SalesStage,
} from "@/lib/sales-cs";
import type { Relationship } from "@/lib/types";
import { HEALTH_EMOJI } from "@/lib/utils";

export function SalesPipelineBoard({
  relationships,
}: {
  relationships: Relationship[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [movingId, setMovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const byColumn = SALES_STAGE_COLUMNS.map((col) => {
    const items = relationships.filter((r) => deriveSalesStage(r) === col.stage);
    return {
      ...col,
      items,
      autoArrivals: countAutoArrivalsForStage(items, col.stage, "sales"),
    };
  });

  async function move(relationshipId: string, salesStage: SalesStage) {
    setError(null);
    setMovingId(relationshipId);
    try {
      const res = await fetch("/api/relationships/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relationshipId, salesStage }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not move relationship");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Network error moving relationship");
    } finally {
      setMovingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-[var(--dusty-rose)]">{error}</p> : null}
      {pending || movingId ? (
        <p className="text-xs ws-muted">Updating pipeline…</p>
      ) : null}

      <div className="flex gap-3 overflow-x-auto pb-4">
        {byColumn.map((col) => (
          <div
            key={col.stage}
            className={`flex w-[15.5rem] shrink-0 flex-col rounded-sm border bg-[color-mix(in_srgb,var(--header-linen)_55%,var(--true-white))] ${
              col.autoArrivals > 0
                ? "border-[color-mix(in_srgb,var(--heritage-sage)_45%,transparent)]"
                : "border-[color-mix(in_srgb,var(--taupe-medium)_40%,transparent)]"
            }`}
          >
            <div className="border-b border-[color-mix(in_srgb,var(--taupe-medium)_35%,transparent)] px-3 py-3">
              <p className="ws-eyebrow">{col.short}</p>
              <p className="mt-1 flex items-center font-heading text-lg leading-tight">
                <Link
                  href={`/sales?stage=${col.stage}`}
                  className="hover:text-[var(--heritage-sage)]"
                >
                  {col.label}
                </Link>
                <AutoArrivalDot count={col.autoArrivals} />
              </p>
              <p className="mt-1 text-xs ws-muted">{col.items.length}</p>
            </div>
            <div className="flex flex-1 flex-col gap-2 p-2 min-h-[12rem]">
              {col.items.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs ws-muted">Empty</p>
              ) : (
                col.items.map((r) => {
                  const stage = deriveSalesStage(r);
                  const isNewArrival =
                    r.lastAutoArrival?.board === "sales" &&
                    r.lastAutoArrival.stage === stage;
                  return (
                    <article
                      key={r.id}
                      className={`rounded-sm bg-[var(--true-white)] p-3 shadow-[0_1px_0_color-mix(in_srgb,var(--taupe-medium)_35%,transparent)] ${
                        isNewArrival
                          ? "ring-1 ring-[color-mix(in_srgb,var(--heritage-sage)_35%,transparent)]"
                          : ""
                      }`}
                    >
                      <Link
                        href={`/relationships/${r.id}?from=sales`}
                        className="font-medium hover:text-[var(--heritage-sage)]"
                      >
                        {r.venue.name}
                      </Link>
                      <p className="mt-1 text-xs ws-muted">
                        {r.owner.firstName} · {HEALTH_EMOJI[r.health]}
                      </p>
                      {r.welcomeBackRequested || r.foundingMember || r.subscribedAt ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {r.subscribedAt ? (
                            <StatusPill tone="good">Subscribed</StatusPill>
                          ) : null}
                          {r.foundingMember ? (
                            <StatusPill tone="good">Founder</StatusPill>
                          ) : null}
                          {r.welcomeBackRequested ? (
                            <StatusPill>Welcome Back</StatusPill>
                          ) : null}
                        </div>
                      ) : null}
                      <label className="mt-3 block text-[0.65rem] uppercase tracking-wider ws-muted">
                        Move to
                        <select
                          className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] bg-[var(--natural-cream)] px-2 py-1.5 text-xs text-[var(--forest-sage)]"
                          value={stage}
                          disabled={movingId === r.id}
                          onChange={(e) => {
                            const next = e.target.value as SalesStage;
                            if (next !== stage) void move(r.id, next);
                          }}
                        >
                          {SALES_STAGE_COLUMNS.map((c) => (
                            <option key={c.stage} value={c.stage}>
                              {SALES_STAGE_LABELS[c.stage]}
                            </option>
                          ))}
                        </select>
                      </label>
                    </article>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
