"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

import { resolveCalendlyEmbedUrl } from "@/lib/marketing/calendly-url";
import { TYPE_BODY, TYPE_MEASURE } from "@/lib/marketing/rhythm";
import { cn } from "@/lib/utils";

const INK = "text-[#24332b]";
const INK_MUTED = "text-[rgba(36,51,43,0.68)]";

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

function useClientHostname(): string | undefined {
  return useSyncExternalStore(
    () => () => {},
    () => window.location.hostname,
    () => undefined,
  );
}

type CalendlyEmbedProps = {
  url: string;
  className?: string;
  /** Optional heading id for aria-labelledby on the booking region. */
  labelledBy?: string;
};

/**
 * Inline Calendly booking UI.
 * Uses an iframe with an explicit responsive height — Calendly’s iframe is
 * height:100%, so min-height alone collapses to a blank body (logo only).
 */
export function CalendlyEmbed({
  url,
  className,
  labelledBy,
}: CalendlyEmbedProps) {
  const resolved = useMemo(() => resolveCalendlyEmbedUrl(url), [url]);
  const hostname = useClientHostname();
  const src = resolved ? withEmbedParams(resolved, hostname) : "";
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const loaded = loadedSrc === src;

  if (!resolved || failed) {
    return (
      <div
        className={cn(
          "rounded-sm border border-[var(--taupe-medium)]/45 bg-[var(--true-white)] px-6 py-10 md:px-10 md:py-12",
          className,
        )}
        role="status"
      >
        <p className={`font-heading text-2xl ${INK} md:text-3xl`}>
          Scheduling is temporarily unavailable
        </p>
        <p className={`mt-4 ${TYPE_BODY} ${INK_MUTED} ${TYPE_MEASURE}`}>
          Please use Contact and we&apos;ll help you find a time.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-sm border border-[var(--taupe-medium)]/40 bg-[var(--true-white)]",
        className,
      )}
      aria-labelledby={labelledBy}
    >
      <div className="relative w-full overflow-x-auto">
        {!loaded ? (
          <div
            className="absolute inset-x-0 top-0 z-10 flex h-[min(70vh,720px)] items-center justify-center bg-[var(--linen)]/55 md:h-[900px]"
            aria-live="polite"
          >
            <p className={`text-sm tracking-wide ${INK_MUTED}`}>
              Loading the calendar…
            </p>
          </div>
        ) : null}
        <iframe
          key={src}
          title="Schedule a Walkthrough calendar"
          src={src}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="block w-full min-w-[320px] border-0"
          style={{
            height: "clamp(640px, 78vh, 920px)",
          }}
          onLoad={() => setLoadedSrc(src)}
          onError={() => setFailed(true)}
        />
      </div>
    </div>
  );
}
