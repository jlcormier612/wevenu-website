"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  relationshipId: string;
  productVenueId: string | null;
  canView: boolean;
  canAssist: boolean;
  canConfigureWg: boolean;
  handedOff: boolean;
  isWhiteGlove: boolean;
  canRecordHandoff: boolean;
};

/**
 * Stage 1F — Access Workspace / Assist from CRM Customer Success relationship.
 */
export function PortalAccessControls({
  relationshipId,
  productVenueId,
  canView,
  canAssist,
  canConfigureWg,
  handedOff,
  isWhiteGlove,
  canRecordHandoff,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!productVenueId || !canView) return null;

  const assistAllowed =
    isWhiteGlove && !handedOff ? canConfigureWg : canAssist;

  async function openPortal(mode: "read" | "assist") {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/support-access/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            portal: "venue",
            mode,
            relationshipId,
            venueId: productVenueId,
          }),
        });
        const data = (await res.json()) as { error?: string; enterUrl?: string };
        if (!res.ok || !data.enterUrl) {
          setError(data.error || "Could not start support access");
          return;
        }
        window.open(data.enterUrl, "_blank", "noopener,noreferrer");
      } catch {
        setError("Could not start support access");
      }
    });
  }

  function recordHandoff() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/relationships/lifecycle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "record_customer_handoff",
            relationshipId,
          }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(data.error || "Could not record handoff");
          return;
        }
        router.refresh();
      } catch {
        setError("Could not record handoff");
      }
    });
  }

  return (
    <div className="mt-3 space-y-2" data-testid="portal-access-controls">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => void openPortal("read")}
          className="inline-flex items-center rounded-sm bg-[var(--forest-sage)] px-3 py-1.5 text-sm font-medium text-[var(--true-white)] hover:bg-[var(--heritage-sage)] disabled:opacity-60"
          data-testid="access-workspace-view"
        >
          Access Workspace
        </button>
        {assistAllowed ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => void openPortal("assist")}
            className="inline-flex items-center rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] px-3 py-1.5 text-sm text-[var(--forest-sage)] hover:bg-[color-mix(in_srgb,var(--soft-sage)_35%,transparent)] disabled:opacity-60"
            data-testid="access-workspace-assist"
          >
            {isWhiteGlove && !handedOff ? "Configure (Assist)" : "Assist / Edit"}
          </button>
        ) : null}
        {!handedOff && canRecordHandoff ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => void recordHandoff()}
            className="inline-flex items-center rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] px-3 py-1.5 text-sm text-[var(--forest-sage)] hover:bg-[color-mix(in_srgb,var(--soft-sage)_35%,transparent)] disabled:opacity-60"
            data-testid="record-customer-handoff"
          >
            Record customer handoff
          </button>
        ) : null}
      </div>
      <p className="text-xs ws-muted">
        Opens the live venue application as HTC staff (read-only by default). Does not use the
        customer&apos;s password or interrupt their session.
        {handedOff
          ? " Customer handoff recorded — assist requires assistance permission."
          : null}
      </p>
      {error ? <p className="text-xs text-[var(--dusty-rose)]">{error}</p> : null}
    </div>
  );
}
