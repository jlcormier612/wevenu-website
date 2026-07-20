"use client";

import { useState } from "react";
import Link from "next/link";

import type { SubscriptionPlanId } from "@/lib/marketing/pricing-page";
import { HOVER_FILL, HOVER_LINK, HOVER_OUTLINE } from "@/lib/marketing/rhythm";
import { cn } from "@/lib/utils";

type PricingCheckoutButtonProps = {
  planId: SubscriptionPlanId;
  label: string;
  /** primary — one filled plan CTA; secondary — quiet outline peers */
  variant?: "primary" | "secondary";
  className?: string;
};

/**
 * Starts Stripe Checkout for a subscription plan (hosted Checkout).
 */
export function PricingCheckoutButton({
  planId,
  label,
  variant = "primary",
  className,
}: PricingCheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Unable to start checkout.");
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start checkout.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={startCheckout}
        disabled={loading}
        className={cn(
          "inline-flex w-full items-center justify-center rounded-full px-6 py-3 text-sm tracking-wide transition duration-200 ease-out disabled:opacity-60",
          variant === "primary" &&
            `bg-[var(--heritage-sage)] text-[var(--true-white)] ${HOVER_FILL}`,
          variant === "secondary" &&
            `border border-[var(--heritage-sage)]/35 bg-transparent text-[var(--forest-sage)] ${HOVER_OUTLINE}`,
          className,
        )}
      >
        {loading ? "Opening checkout…" : label}
      </button>
      {error ? (
        <p className="mt-3 text-center text-xs leading-[1.7] text-[var(--forest-sage)]/55">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type PricingPortalButtonProps = {
  sessionId: string;
  label?: string;
  className?: string;
};

/**
 * Opens Stripe Customer Portal from a completed Checkout session.
 */
export function PricingPortalButton({
  sessionId,
  label = "Manage billing",
  className,
}: PricingPortalButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Unable to open billing portal.");
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open billing portal.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={openPortal}
        disabled={loading}
        className={cn(
          `inline-flex items-center justify-center rounded-full border border-[var(--heritage-sage)]/35 bg-transparent px-6 py-3 text-sm tracking-wide text-[var(--forest-sage)] transition duration-200 ease-out ${HOVER_OUTLINE} disabled:opacity-60`,
          className,
        )}
      >
        {loading ? "Opening…" : label}
      </button>
      {error ? (
        <p className="mt-3 text-center text-xs text-[var(--forest-sage)]/55">{error}</p>
      ) : null}
      <p className="mt-4 text-center text-sm text-[var(--forest-sage)]/50">
        Or{" "}
        <Link href="/pricing" className={HOVER_LINK}>
          return to pricing
        </Link>
        .
      </p>
    </div>
  );
}
