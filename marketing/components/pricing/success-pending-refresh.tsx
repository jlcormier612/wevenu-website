"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Soft client refresh while webhook / Stripe reconcile catches up.
 * After bounded refreshes, offers an explicit retry that re-reads Stripe
 * server-side (never trusts the success URL alone).
 */
export function SuccessPendingRefresh({
  sessionId,
  maxRefreshes = 12,
  intervalMs = 2000,
}: {
  sessionId?: string | null;
  maxRefreshes?: number;
  intervalMs?: number;
}) {
  const router = useRouter();
  const trimmedSession = sessionId?.trim() || "";
  const [refreshes, setRefreshes] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);

  useEffect(() => {
    if (refreshes >= maxRefreshes) return;
    const timer = window.setTimeout(() => {
      setRefreshes((n) => n + 1);
      router.refresh();
    }, intervalMs);
    return () => window.clearTimeout(timer);
  }, [refreshes, maxRefreshes, intervalMs, router]);

  async function retryConfirm() {
    if (!trimmedSession || retrying) return;
    setRetrying(true);
    setRetryMessage(null);
    try {
      const res = await fetch("/api/stripe/reconcile-checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session_id: trimmedSession }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        status?: string;
        reason?: string;
        error?: string;
      };
      if (data.ok && (data.status === "reconciled" || data.status === "already_enrolled")) {
        setRetryMessage("Confirmed — refreshing your next step…");
        router.refresh();
        return;
      }
      if (data.ok && data.status === "not_eligible") {
        setRetryMessage(
          "We couldn't complete your subscription. Your setup is saved, so you can pick up right where you left off from your confirmation email or Pricing.",
        );
        return;
      }
      setRetryMessage(
        "Still confirming — check your email for the next step, or try again in a moment.",
      );
      router.refresh();
    } catch {
      setRetryMessage(
        "We couldn't confirm just now. Your setup is saved — try again shortly, or use the link in your email.",
      );
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="mt-6 space-y-3" aria-live="polite">
      <p className="text-sm leading-[1.7] text-[var(--forest-sage)]/55">
        {refreshes >= maxRefreshes
          ? "Still confirming your subscription. Your progress is saved."
          : "Checking for your account setup…"}
      </p>
      {refreshes >= maxRefreshes && trimmedSession ? (
        <button
          type="button"
          onClick={() => void retryConfirm()}
          disabled={retrying}
          className="text-sm font-medium text-[var(--heritage-sage)] underline-offset-2 hover:underline disabled:opacity-60"
          data-testid="reconcile-checkout-retry"
        >
          {retrying ? "Confirming…" : "Try confirming again"}
        </button>
      ) : null}
      {retryMessage ? (
        <p className="text-sm leading-[1.7] text-[var(--forest-sage)]/70">{retryMessage}</p>
      ) : null}
    </div>
  );
}
