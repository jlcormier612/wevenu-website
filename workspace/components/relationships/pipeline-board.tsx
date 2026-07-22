"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { StatusPill } from "@/components/shared/ui";
import { PIPELINE_COLUMNS, toPipelineStatus } from "@/lib/pipeline";
import type { Relationship } from "@/lib/types";
import { HEALTH_EMOJI, STATUS_LABELS } from "@/lib/utils";

export function PipelineBoard({ relationships }: { relationships: Relationship[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [movingId, setMovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const byColumn = PIPELINE_COLUMNS.map((col) => ({
    ...col,
    items: relationships.filter((r) => toPipelineStatus(r.status) === col.status),
  }));

  async function move(relationshipId: string, status: string) {
    setError(null);
    setMovingId(relationshipId);
    try {
      const res = await fetch("/api/relationships/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relationshipId, status }),
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
            key={col.status}
            className="flex w-[15.5rem] shrink-0 flex-col rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_40%,transparent)] bg-[color-mix(in_srgb,var(--header-linen)_55%,var(--true-white))]"
          >
            <div className="border-b border-[color-mix(in_srgb,var(--taupe-medium)_35%,transparent)] px-3 py-3">
              <p className="ws-eyebrow">{col.short}</p>
              <p className="mt-1 font-heading text-lg leading-tight">{col.label}</p>
              <p className="mt-1 text-xs ws-muted">{col.items.length}</p>
            </div>
            <div className="flex flex-1 flex-col gap-2 p-2 min-h-[12rem]">
              {col.items.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs ws-muted">Empty</p>
              ) : (
                col.items.map((r) => (
                  <article
                    key={r.id}
                    className="rounded-sm bg-[var(--true-white)] p-3 shadow-[0_1px_0_color-mix(in_srgb,var(--taupe-medium)_35%,transparent)]"
                  >
                    <Link
                      href={`/relationships/${r.id}`}
                      className="font-medium hover:text-[var(--heritage-sage)]"
                    >
                      {r.venue.name}
                    </Link>
                    <p className="mt-1 text-xs ws-muted">
                      {r.owner.firstName} · {HEALTH_EMOJI[r.health]}
                    </p>
                    {r.status === "support" || r.welcomeBackRequested || r.foundingMember ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {r.foundingMember ? <StatusPill tone="good">Founder</StatusPill> : null}
                        {r.welcomeBackRequested ? (
                          <StatusPill>Welcome Back</StatusPill>
                        ) : null}
                        {r.status === "support" || r.supportOpenCount > 0 ? (
                          <StatusPill tone="warn">Support</StatusPill>
                        ) : null}
                      </div>
                    ) : null}
                    <label className="mt-3 block text-[0.65rem] uppercase tracking-wider ws-muted">
                      Move to
                      <select
                        className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] bg-[var(--natural-cream)] px-2 py-1.5 text-xs text-[var(--forest-sage)]"
                        value={toPipelineStatus(r.status)}
                        disabled={movingId === r.id}
                        onChange={(e) => {
                          if (e.target.value !== toPipelineStatus(r.status)) {
                            void move(r.id, e.target.value);
                          }
                        }}
                      >
                        {PIPELINE_COLUMNS.map((c) => (
                          <option key={c.status} value={c.status}>
                            {STATUS_LABELS[c.status]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </article>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
