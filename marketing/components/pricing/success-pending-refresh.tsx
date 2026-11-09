"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Soft client refresh while webhook enrollment is still catching up.
 * Does not fetch activation tokens itself — only reloads the server page.
 */
export function SuccessPendingRefresh({
  maxRefreshes = 12,
  intervalMs = 2000,
}: {
  maxRefreshes?: number;
  intervalMs?: number;
}) {
  const router = useRouter();
  const [refreshes, setRefreshes] = useState(0);

  useEffect(() => {
    if (refreshes >= maxRefreshes) return;
    const timer = window.setTimeout(() => {
      setRefreshes((n) => n + 1);
      router.refresh();
    }, intervalMs);
    return () => window.clearTimeout(timer);
  }, [refreshes, maxRefreshes, intervalMs, router]);

  return (
    <p className="mt-6 text-sm leading-[1.7] text-[var(--forest-sage)]/55" aria-live="polite">
      {refreshes >= maxRefreshes
        ? "Still finishing up — check your email for the next step, or refresh this page in a moment."
        : "Checking for your account setup…"}
    </p>
  );
}
