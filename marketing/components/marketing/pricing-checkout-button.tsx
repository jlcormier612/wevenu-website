"use client";

import { useState } from "react";
import Link from "next/link";

import { OnboardingSelection } from "@/components/marketing/onboarding-selection";
import type { OnboardingType } from "@/lib/marketing/enrollment";
import { getPlanDisplayName } from "@/lib/marketing/onboarding-packages";
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
 * Pricing card CTA → onboarding selection → single Stripe Checkout Session.
 * Welcome Back checkbox lives on the selection step (never blocks checkout).
 */
export function PricingCheckoutButton({
  planId,
  label,
  variant = "primary",
  className,
}: PricingCheckoutButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout(selection: {
    onboardingType: OnboardingType;
    welcomeBack: boolean;
    legalAccepted: boolean;
  }) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: planId,
          welcome_back: selection.welcomeBack,
          onboarding_type: selection.onboardingType,
          legal_accepted: selection.legalAccepted,
        }),
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
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
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
        {label}
      </button>

      <OnboardingSelection
        open={open}
        planLabel={getPlanDisplayName(planId)}
        loading={loading}
        error={error}
        onClose={() => {
          if (!loading) {
            setOpen(false);
            setError(null);
          }
        }}
        onContinue={startCheckout}
      />
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
