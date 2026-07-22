"use client";

import Script from "next/script";
import { useEffect, useId, useState } from "react";

declare global {
  interface Window {
    Calendly?: {
      initInlineWidget: (opts: {
        url: string;
        parentElement: HTMLElement;
        prefill?: Record<string, string>;
        utm?: Record<string, string>;
      }) => void;
    };
  }
}

/**
 * Official Calendly inline embed. Parent page supplies Hello to Cheers framing.
 */
export function CalendlyEmbed({ url }: { url: string }) {
  const reactId = useId();
  const containerId = `calendly-inline-${reactId.replace(/:/g, "")}`;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!ready || !window.Calendly) return;
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = "";
    window.Calendly.initInlineWidget({
      url,
      parentElement: el,
    });
  }, [ready, url, containerId]);

  return (
    <div className="overflow-hidden rounded-[2rem] border border-[var(--taupe-light)] bg-[var(--true-white)]">
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
      <div
        id={containerId}
        className="calendly-inline-widget min-h-[680px] w-full"
        data-url={url}
      />
      <Script
        src="https://assets.calendly.com/assets/external/widget.js"
        strategy="lazyOnload"
        onLoad={() => setReady(true)}
      />
    </div>
  );
}
