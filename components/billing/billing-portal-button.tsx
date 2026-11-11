"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

export function BillingPortalButton({
  disabled,
  label = "Open billing portal",
}: {
  disabled?: boolean;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Could not open the billing portal.");
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open the billing portal.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" onClick={openPortal} disabled={disabled || loading}>
        {loading ? "Opening…" : label}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
