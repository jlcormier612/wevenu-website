"use client";

import { useState, useTransition } from "react";

type Props = {
  surface: "client" | "vendor";
  venueId: string | null;
  clientId: string | null;
  vendorId: string | null;
  relationshipId: string | null;
};

/**
 * Stage 1F — open client/vendor context from Partner Support Inbox as HTC staff.
 */
export function PartnerPortalAccess({
  surface,
  venueId,
  clientId,
  vendorId,
  relationshipId,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canOpen =
    surface === "client"
      ? Boolean(clientId && venueId)
      : Boolean(vendorId && venueId);

  if (!canOpen) return null;

  function open(mode: "read" | "assist") {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/support-access/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            portal: surface,
            mode,
            venueId,
            clientId,
            vendorId,
            relationshipId,
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

  return (
    <div className="mt-3 space-y-1" data-testid="partner-portal-access">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => void open("read")}
          className="rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] px-2.5 py-1 text-xs text-[var(--forest-sage)] hover:bg-[color-mix(in_srgb,var(--soft-sage)_35%,transparent)] disabled:opacity-60"
          data-testid={`access-${surface}-view`}
        >
          {surface === "client" ? "View client portal" : "View vendor portal"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => void open("assist")}
          className="rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] px-2.5 py-1 text-xs text-[var(--forest-sage)] hover:bg-[color-mix(in_srgb,var(--soft-sage)_35%,transparent)] disabled:opacity-60"
          data-testid={`access-${surface}-assist`}
        >
          Assist / Edit
        </button>
      </div>
      {error ? <p className="text-xs text-[var(--dusty-rose)]">{error}</p> : null}
    </div>
  );
}
