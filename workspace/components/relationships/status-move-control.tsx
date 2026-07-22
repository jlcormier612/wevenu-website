"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { PIPELINE_COLUMNS, toPipelineStatus } from "@/lib/pipeline";
import type { RelationshipStatus } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/utils";

export function StatusMoveControl({
  relationshipId,
  status,
}: {
  relationshipId: string;
  status: RelationshipStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const current = toPipelineStatus(status);

  async function onChange(next: string) {
    if (next === current) return;
    setError(null);
    try {
      const res = await fetch("/api/relationships/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relationshipId, status: next }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not update status");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Network error");
    }
  }

  return (
    <div className="ws-panel p-5">
      <p className="ws-eyebrow">Pipeline</p>
      <h2 className="mt-1 font-heading text-xl">Move stage</h2>
      <p className="mt-2 text-sm ws-muted">
        One relationship — status changes, the record stays. Overlay flags (Founder, Welcome
        Back, Support) remain on this record.
      </p>
      <label className="mt-4 block text-sm">
        <span className="ws-muted">Current stage</span>
        <select
          className="mt-1.5 w-full max-w-md rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] bg-[var(--true-white)] px-3 py-2 text-[var(--forest-sage)]"
          value={current}
          disabled={pending}
          onChange={(e) => void onChange(e.target.value)}
        >
          {PIPELINE_COLUMNS.map((c) => (
            <option key={c.status} value={c.status}>
              {STATUS_LABELS[c.status]}
            </option>
          ))}
        </select>
      </label>
      {pending ? <p className="mt-2 text-xs ws-muted">Saving…</p> : null}
      {error ? <p className="mt-2 text-sm text-[var(--dusty-rose)]">{error}</p> : null}
    </div>
  );
}
