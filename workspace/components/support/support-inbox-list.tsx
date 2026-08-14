"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import type { SupportInboxItem } from "@shared/relationships";

const TYPE_LABELS: Record<string, string> = {
  support: "Get Help",
  bug: "Bug",
  feature: "Idea",
  nps: "NPS",
  general: "Feedback",
};

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function SupportInboxList({
  items,
  focusItemId = null,
}: {
  items: SupportInboxItem[];
  focusItemId?: string | null;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  useEffect(() => {
    const targetId = focusItemId?.trim() || null;
    if (!targetId) return;
    const t = window.setTimeout(() => {
      const row = document.getElementById(`support-inbox-item-${targetId}`);
      if (row) {
        row.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightedId(targetId);
      }
    }, 80);
    return () => window.clearTimeout(t);
  }, [focusItemId, items]);

  useEffect(() => {
    if (!highlightedId) return;
    const t = window.setTimeout(() => setHighlightedId(null), 4000);
    return () => window.clearTimeout(t);
  }, [highlightedId]);

  function resolve(itemId: string) {
    setError(null);
    setPendingId(itemId);
    startTransition(async () => {
      try {
        const res = await fetch("/api/support", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "resolve", itemId }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(data.error || "Could not resolve");
          setPendingId(null);
          return;
        }
        router.refresh();
      } catch {
        setError("Could not resolve");
      } finally {
        setPendingId(null);
      }
    });
  }

  if (items.length === 0) {
    return (
      <p className="rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_40%,transparent)] bg-[var(--true-white)] px-4 py-8 text-center text-sm text-[color-mix(in_oklch,var(--forest-sage)_70%,transparent)]">
        No items in this view.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p className="text-sm text-[var(--dusty-rose)]">{error}</p>
      ) : null}
      {items.map((item) => {
        const focused =
          highlightedId === item.id || focusItemId === item.id;
        return (
          <article
            key={item.id}
            id={`support-inbox-item-${item.id}`}
            className={`scroll-mt-24 rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_40%,transparent)] bg-[var(--true-white)] px-4 py-4 ${
              focused
                ? "ring-2 ring-[var(--heritage-sage)] ring-offset-2 ring-offset-[var(--natural-cream)]"
                : ""
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-[color-mix(in_oklch,var(--forest-sage)_65%,transparent)]">
                  <span className="rounded-sm bg-[var(--header-linen)] px-1.5 py-0.5 font-medium capitalize text-[var(--forest-sage)]">
                    {item.surface}
                  </span>
                  <span>{TYPE_LABELS[item.type] ?? item.type}</span>
                  <span>·</span>
                  <span>{formatWhen(item.createdAt)}</span>
                  {item.status !== "open" ? (
                    <>
                      <span>·</span>
                      <span className="capitalize">{item.status}</span>
                    </>
                  ) : null}
                </div>
                <h2 className="font-heading text-lg text-[var(--forest-sage)]">
                  {item.subject}
                </h2>
                <p className="text-sm text-[color-mix(in_oklch,var(--forest-sage)_80%,transparent)]">
                  {[item.actorName, item.actorEmail].filter(Boolean).join(" · ") ||
                    "Unknown actor"}
                </p>
              </div>
              {item.status === "open" ? (
                <button
                  type="button"
                  disabled={isPending && pendingId === item.id}
                  onClick={() => resolve(item.id)}
                  className="shrink-0 rounded-sm bg-[var(--forest-sage)] px-3 py-1.5 text-sm text-[var(--true-white)] disabled:opacity-60"
                >
                  {isPending && pendingId === item.id
                    ? "Resolving…"
                    : "Resolve"}
                </button>
              ) : null}
            </div>

            {item.body ? (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--forest-sage)]">
                {item.body}
              </p>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[color-mix(in_oklch,var(--forest-sage)_65%,transparent)]">
              {item.rating != null ? (
                <span>Rating {item.rating}/10</span>
              ) : null}
              {item.allowPublicShare ? <span>Public share OK</span> : null}
              {item.relatedRelationshipId ? (
                <Link
                  href={`/relationships/${item.relatedRelationshipId}`}
                  className="underline decoration-dotted underline-offset-2 hover:text-[var(--forest-sage)]"
                >
                  Related venue: {item.relatedVenueName || "View relationship"}
                </Link>
              ) : item.relatedVenueId ? (
                <span>Product venue linked (no CRM relationship yet)</span>
              ) : (
                <span>No related venue</span>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
