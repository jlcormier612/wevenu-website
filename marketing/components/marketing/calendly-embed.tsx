"use client";

import { useEffect, useState } from "react";

/** Calendly docs use ~700px; extra room so the month grid isn’t clipped. */
const WIDGET_HEIGHT_PX = 900;

function withEmbedParams(raw: string, hostname?: string): string {
  try {
    const u = new URL(raw);
    u.searchParams.set("embed_type", "Inline");
    if (hostname) u.searchParams.set("embed_domain", hostname);
    return u.toString();
  } catch {
    return raw;
  }
}

/**
 * Inline Calendly booking UI.
 * Uses an iframe with an explicit height — Calendly’s iframe is height:100%,
 * so min-height alone collapses to a blank body (logo only).
 */
export function CalendlyEmbed({ url }: { url: string }) {
  const [src, setSrc] = useState(() => withEmbedParams(url));

  useEffect(() => {
    setSrc(withEmbedParams(url, window.location.hostname));
  }, [url]);

  return (
    <div className="rounded-[2rem] border border-[var(--taupe-light)] bg-[var(--true-white)]">
      <div className="border-b border-[var(--taupe-light)] px-6 py-5 md:px-8">
        <p className="text-xs tracking-[0.18em] uppercase text-[var(--heritage-sage)]">
          Schedule
        </p>
        <h2 className="mt-1 font-heading text-2xl text-[var(--forest-sage)] md:text-3xl">
          Pick a time that works
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--forest-sage)]/70">
          Choose a slot below. We&apos;ll confirm by email and prepare for your venue.
        </p>
      </div>
      <iframe
        title="Schedule a Walkthrough"
        src={src}
        loading="lazy"
        className="block w-full"
        style={{ minWidth: 320, height: WIDGET_HEIGHT_PX, border: 0 }}
      />
    </div>
  );
}
