"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export function UpdatePaymentMethodButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error || "Could not open the billing portal.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Could not open the billing portal. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        className="w-full"
        disabled={pending}
        onClick={() => void openPortal()}
      >
        {pending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Opening billing…
          </>
        ) : (
          "Update Payment Method"
        )}
      </Button>
      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/15 px-3 py-2 text-sm text-foreground"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
