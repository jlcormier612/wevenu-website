"use client";

import { useEffect, useState } from "react";

import {
  MARKETING_COOKIE_PREFS_KEY,
  type MarketingCookiePrefs,
  writeMarketingAnalyticsConsent,
} from "@shared/analytics";

type CookiePrefs = MarketingCookiePrefs;

const DEFAULT_PREFS: CookiePrefs = {
  necessary: true,
  analytics: false,
  marketing: false,
};

/**
 * Cookie preferences — calm self-serve controls stored locally.
 * Analytics toggle gates GA4 via MarketingGa4Provider (Phase 2C).
 */
export function CookiePreferencesExperience() {
  const [prefs, setPrefs] = useState<CookiePrefs>(DEFAULT_PREFS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(MARKETING_COOKIE_PREFS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<CookiePrefs>;
        setPrefs({
          necessary: true,
          analytics: Boolean(parsed.analytics),
          marketing: Boolean(parsed.marketing),
        });
      }
    } catch {
      // ignore malformed storage
    }
  }, []);

  function save(next: CookiePrefs) {
    setPrefs(next);
    window.localStorage.setItem(MARKETING_COOKIE_PREFS_KEY, JSON.stringify(next));
    // Keep analytics consent event in sync for the GA4 provider.
    writeMarketingAnalyticsConsent(next.analytics);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="bg-[var(--true-white)] px-6 pt-[140px] pb-28 md:pb-36">
      <div className="mx-auto max-w-3xl">
        <p className="text-[0.7125rem] tracking-[0.22em] uppercase text-[var(--heritage-sage)]/82">
          Cookies
        </p>
        <h1 className="mt-8 font-heading text-[2.52rem] font-medium leading-[1.16] tracking-tight text-[var(--forest-sage)] md:text-[4.2rem]">
          Cookie Preferences
        </h1>
        <p className="mt-8 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg max-w-[65ch]">
          We use cookies carefully. Essential cookies keep the site and product working.
          Everything else is your choice.
        </p>

        <div className="mt-14 space-y-8">
          <PreferenceRow
            title="Strictly necessary"
            description="Required for security, authentication, and core site function. Always on."
            checked
            locked
          />
          <PreferenceRow
            title="Analytics"
            description="Help us understand how people use Hello to Cheers in aggregate so we can improve the experience."
            checked={prefs.analytics}
            onChange={(analytics) => save({ ...prefs, analytics })}
          />
          <PreferenceRow
            title="Marketing"
            description="Used sparingly to understand whether our campaigns are helpful—never to sell personal profiles."
            checked={prefs.marketing}
            onChange={(marketing) => save({ ...prefs, marketing })}
          />
        </div>

        {saved ? (
          <p className="mt-8 text-sm text-[var(--heritage-sage)]">Preferences saved.</p>
        ) : null}

        <p className="mt-12 text-sm leading-[1.7] text-[var(--forest-sage)]/55">
          You can also review our{" "}
          <a href="/cookie-policy" className="underline-offset-4 hover:underline">
            Cookie Policy
          </a>{" "}
          and{" "}
          <a href="/privacy" className="underline-offset-4 hover:underline">
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  );
}

function PreferenceRow({
  title,
  description,
  checked,
  locked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  locked?: boolean;
  onChange?: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-t border-[var(--taupe-medium)]/40 pt-8">
      <div className="max-w-xl">
        <h2 className="font-heading text-2xl text-[var(--forest-sage)]">{title}</h2>
        <p className="mt-3 text-sm leading-[1.7] text-[var(--forest-sage)]/65 md:text-base">
          {description}
        </p>
      </div>
      <label className="flex shrink-0 items-center gap-2 pt-1 text-sm text-[var(--forest-sage)]/70">
        <input
          type="checkbox"
          className="h-4 w-4 accent-[var(--heritage-sage)]"
          checked={checked}
          disabled={locked}
          onChange={(e) => onChange?.(e.target.checked)}
        />
        {locked ? "Required" : checked ? "On" : "Off"}
      </label>
    </div>
  );
}
