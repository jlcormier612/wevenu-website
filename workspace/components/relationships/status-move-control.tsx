"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  CS_STAGE_COLUMNS,
  CS_STAGE_LABELS,
  SALES_STAGE_COLUMNS,
  SALES_STAGE_LABELS,
  deriveCustomerSuccessStage,
  deriveSalesStage,
  isInCustomerSuccessView,
} from "@/lib/sales-cs";
import type { Relationship, RelationshipStatus } from "@/lib/types";

export function StatusMoveControl({
  relationship,
}: {
  relationship: Relationship;
  /** @deprecated use relationship */
  relationshipId?: string;
  status?: RelationshipStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isCustomer = isInCustomerSuccessView(relationship);
  const salesStage = deriveSalesStage(relationship);
  const csStage = deriveCustomerSuccessStage(relationship);

  async function onSalesChange(next: string) {
    if (next === salesStage) return;
    setError(null);
    try {
      const res = await fetch("/api/relationships/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relationshipId: relationship.id,
          salesStage: next,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not update stage");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Network error");
    }
  }

  async function onCsChange(next: string) {
    if (next === csStage) return;
    setError(null);
    try {
      const res = await fetch("/api/relationships/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relationshipId: relationship.id,
          customerSuccessStage: next,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not update stage");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Network error");
    }
  }

  return (
    <div className="ws-panel p-5">
      <p className="ws-eyebrow">{isCustomer ? "Customer Success" : "Sales"}</p>
      <h2 className="mt-1 font-heading text-xl">Move stage</h2>
      <p className="mt-2 text-sm ws-muted">
        One relationship — {isCustomer ? "Customer Success" : "Sales"} stage
        changes, the record stays. Timeline, communications, and documents are
        shared.
      </p>
      <label className="mt-4 block text-sm">
        <span className="ws-muted">
          Current {isCustomer ? "lifecycle" : "sales"} stage
        </span>
        {isCustomer ? (
          <select
            className="mt-1.5 w-full max-w-md rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] bg-[var(--true-white)] px-3 py-2 text-[var(--forest-sage)]"
            value={csStage}
            disabled={pending}
            onChange={(e) => void onCsChange(e.target.value)}
          >
            {CS_STAGE_COLUMNS.map((c) => (
              <option key={c.stage} value={c.stage}>
                {CS_STAGE_LABELS[c.stage]}
              </option>
            ))}
          </select>
        ) : (
          <select
            className="mt-1.5 w-full max-w-md rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] bg-[var(--true-white)] px-3 py-2 text-[var(--forest-sage)]"
            value={salesStage}
            disabled={pending}
            onChange={(e) => void onSalesChange(e.target.value)}
          >
            {SALES_STAGE_COLUMNS.map((c) => (
              <option key={c.stage} value={c.stage}>
                {SALES_STAGE_LABELS[c.stage]}
              </option>
            ))}
          </select>
        )}
      </label>
      {pending ? <p className="mt-2 text-xs ws-muted">Saving…</p> : null}
      {error ? <p className="mt-2 text-sm text-[var(--dusty-rose)]">{error}</p> : null}
    </div>
  );
}
