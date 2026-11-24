"use client";

/**
 * First-visit marketing cookie notice — analytics OFF until the visitor accepts.
 * Persists the same hellotocheers-cookie-prefs key used by /cookies and GA4.
 */

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  hasMarketingCookieChoice,
  writeMarketingAnalyticsConsent,
} from "@shared/analytics";

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!hasMarketingCookieChoice());
  }, []);

  function choose(analytics: boolean) {
    writeMarketingAnalyticsConsent(analytics);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie preferences"
      className="fixed inset-x-0 bottom-0 z-[60] px-4 pb-4 pt-2 md:px-6 md:pb-6"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-sm border border-[var(--taupe-medium)]/55 bg-[var(--header-linen)] px-5 py-4 shadow-[0_18px_50px_-28px_rgba(47,55,47,0.45)] md:flex-row md:items-center md:gap-6 md:px-6 md:py-5">
        <div className="min-w-0 flex-1">
          <p className="font-heading text-lg font-medium leading-snug text-[var(--botanical)] md:text-xl">
            Cookies on Hello to Cheers
          </p>
          <p className="mt-2 text-sm leading-[1.65] text-[var(--forest-sage)]/88">
            We use essential cookies to run the site. Optional analytics cookies
            help us improve Hello to Cheers and stay off until you choose.
            Review details in our{" "}
            <Link
              href="/cookie-policy"
              className="underline underline-offset-4 hover:text-[var(--botanical)]"
            >
              Cookie Policy
            </Link>{" "}
            or manage choices anytime via{" "}
            <Link
              href="/cookies"
              className="underline underline-offset-4 hover:text-[var(--botanical)]"
            >
              Cookie Preferences
            </Link>
            .
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => choose(false)}
            className="rounded-sm border border-[var(--taupe-dark)]/55 bg-[var(--true-white)] px-4 py-2.5 text-sm font-medium text-[var(--forest-sage)] transition-colors hover:border-[var(--botanical)]/50 hover:text-[var(--botanical)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--botanical)] focus-visible:ring-offset-2"
          >
            Essential only
          </button>
          <button
            type="button"
            onClick={() => choose(true)}
            className="rounded-sm bg-[var(--botanical)] px-4 py-2.5 text-sm font-medium text-[var(--true-white)] transition-opacity hover:opacity-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--botanical)] focus-visible:ring-offset-2"
          >
            Accept analytics
          </button>
        </div>
      </div>
    </div>
  );
}
