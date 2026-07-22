"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { ProductSyncState, ProductSyncStepRecord } from "@/lib/types";
import { Panel, StatusPill } from "@/components/shared/ui";

const STEP_ORDER = [
  "venue",
  "workspace",
  "website",
  "subscription",
  "owner_account",
  "onboarding",
  "launch",
] as const;

const STEP_LABELS: Record<(typeof STEP_ORDER)[number], string> = {
  venue: "Venue",
  workspace: "Workspace",
  website: "Website",
  subscription: "Subscription",
  owner_account: "Owner Account",
  onboarding: "Onboarding",
  launch: "Launch",
};

function toneForStatus(
  status: string,
): "good" | "warn" | "muted" | "neutral" | undefined {
  switch (status) {
    case "completed":
    case "skipped":
      return "good";
    case "running":
    case "pending":
      return "warn";
    case "failed":
      return "warn";
    default:
      return "muted";
  }
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

export function ProductSyncPanel({
  relationshipId,
  productSync,
  canProvision,
}: {
  relationshipId: string;
  productSync?: ProductSyncState | null;
  canProvision: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const steps: ProductSyncStepRecord[] =
    productSync?.steps?.length && productSync.steps.length > 0
      ? productSync.steps
      : STEP_ORDER.map((id) => ({
          id,
          label: STEP_LABELS[id],
          status: "pending" as const,
        }));

  const overall = productSync?.status ?? "idle";
  const adapter = productSync?.adapter ?? "local";

  async function onProvision(force: boolean) {
    setError(null);
    setDone(null);
    try {
      const res = await fetch("/api/relationships/product-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relationshipId, force }),
      });
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        status?: string;
      };
      if (!res.ok) {
        setError(data.error || "Could not run product sync");
        return;
      }
      setDone(data.message || `Sync ${data.status ?? "done"}`);
      startTransition(() => router.refresh());
    } catch {
      setError("Network error");
    }
  }

  return (
    <Panel
      title="Product Sync"
      action={
        <StatusPill tone={toneForStatus(overall)}>{statusLabel(overall)}</StatusPill>
      }
    >
      <p className="text-sm ws-muted">
        Provisioning pipeline after subscribe: Venue → Workspace → Website →
        Subscription → Owner Account → Onboarding → Launch.
        {adapter === "local" || !productSync ? (
          <> Currently using the local (simulated) adapter — see{" "}
          <code className="text-xs">shared/product-sync/README.md</code>.</>
        ) : (
          <> Adapter: {adapter}.</>
        )}
      </p>

      <ol className="mt-5 space-y-2">
        {steps.map((step) => (
          <li
            key={step.id}
            className="flex flex-wrap items-center justify-between gap-2 border-b border-[color-mix(in_srgb,var(--taupe-medium)_28%,transparent)] py-2 last:border-0"
          >
            <div>
              <p className="text-sm font-medium">{step.label}</p>
              {step.resourceId ? (
                <p className="mt-0.5 text-xs ws-muted font-mono">{step.resourceId}</p>
              ) : null}
              {step.error ? (
                <p className="mt-0.5 text-xs text-[var(--dusty-rose)]">{step.error}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              {step.simulated ? (
                <span className="text-[10px] uppercase tracking-wide ws-muted">sim</span>
              ) : null}
              <StatusPill tone={toneForStatus(step.status)}>
                {statusLabel(step.status)}
              </StatusPill>
            </div>
          </li>
        ))}
      </ol>

      {(productSync?.venueId || productSync?.workspaceId) && (
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          {productSync.venueId ? (
            <>
              <dt className="ws-muted">Venue id</dt>
              <dd className="font-mono text-xs">{productSync.venueId}</dd>
            </>
          ) : null}
          {productSync.workspaceId ? (
            <>
              <dt className="ws-muted">Workspace id</dt>
              <dd className="font-mono text-xs">{productSync.workspaceId}</dd>
            </>
          ) : null}
        </dl>
      )}

      {productSync?.lastError ? (
        <p className="mt-3 text-sm text-[var(--dusty-rose)]">{productSync.lastError}</p>
      ) : null}

      {canProvision ? (
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => void onProvision(false)}
            className="rounded-sm bg-[var(--heritage-sage)] px-4 py-2 text-sm font-medium text-[var(--true-white)] disabled:opacity-60"
          >
            {overall === "failed" ? "Retry provision" : "Provision product"}
          </button>
          {overall === "completed" || overall === "failed" ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => void onProvision(true)}
              className="rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--true-white)] px-4 py-2 text-sm font-medium text-[var(--forest-sage)] disabled:opacity-60"
            >
              Force re-run
            </button>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-xs ws-muted">
          Owner or Administrator can re-run provisioning from this panel.
        </p>
      )}

      {pending ? <p className="mt-2 text-xs ws-muted">Running…</p> : null}
      {done ? <p className="mt-2 text-sm text-[var(--heritage-sage)]">{done}</p> : null}
      {error ? <p className="mt-2 text-sm text-[var(--dusty-rose)]">{error}</p> : null}
    </Panel>
  );
}
