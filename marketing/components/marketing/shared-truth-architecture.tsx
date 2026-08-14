"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Scroll-scrubbed “One Shared Truth” diagram.
 * Muted PNG atmosphere + radial illuminations.
 * No framer-motion — matches marketing scroll / reduced-motion patterns.
 */

const ART_SRC = "/marketing/homepage-one-shared-truth.png";

const STAGES = [
  {
    id: "venue",
    caption: "Run your business from one relationship.",
    // Centers from pixel sampling of homepage-one-shared-truth.png
    cx: 50,
    cy: 30.5,
  },
  {
    id: "couple",
    caption: "Plan without disconnected tools.",
    cx: 69,
    cy: 58,
  },
  {
    id: "vendor",
    caption: "Become part of the venue's hospitality.",
    cx: 22,
    cy: 58,
  },
] as const;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function stageStrength(progress: number, index: number) {
  const start = 0.06 + index * 0.22;
  return smoothstep(start, start + 0.16, progress);
}

function finaleStrength(progress: number) {
  return smoothstep(0.7, 0.9, progress);
}

function activeCaptionIndex(progress: number, reduced: boolean) {
  if (reduced) return 2;
  if (progress >= 0.5) return 2;
  if (progress >= 0.28) return 1;
  if (progress >= 0.06) return 0;
  return -1;
}

export function SharedTruthArchitecture({ className }: { className?: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setReduced(true);
      setProgress(1);
      return;
    }

    const track = trackRef.current;
    if (!track) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = track.getBoundingClientRect();
      const travel = Math.max(1, track.offsetHeight - window.innerHeight);
      const scrolled = clamp(-rect.top, 0, travel);
      setProgress(scrolled / travel);
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const venue = reduced ? 1 : stageStrength(progress, 0);
  const couple = reduced ? 1 : stageStrength(progress, 1);
  const vendor = reduced ? 1 : stageStrength(progress, 2);
  const finale = reduced ? 1 : finaleStrength(progress);
  const strengths = [venue, couple, vendor] as const;

  const captionIndex = activeCaptionIndex(progress, reduced);
  const caption = captionIndex >= 0 ? (STAGES.at(captionIndex)?.caption ?? null) : null;

  // Full art blooms as the network completes — “ONE SHARED TRUTH” illuminated
  const fullReveal = reduced
    ? 1
    : clamp(venue * 0.2 + couple * 0.2 + vendor * 0.2 + finale * 0.65, 0, 1);

  return (
    <div
      ref={trackRef}
      className={cn(
        "shared-truth-track relative",
        reduced ? "min-h-0" : "h-[min(145vh,920px)] md:h-[min(155vh,1040px)]",
        className,
      )}
    >
      <div
        className={cn(
          "shared-truth-sticky mx-auto w-full max-w-[min(100%,34rem)] md:max-w-[min(100%,44rem)] lg:max-w-[min(100%,52rem)]",
          reduced ? "relative" : "sticky top-[max(1.25rem,7vh)]",
        )}
      >
        <div className="relative mx-auto aspect-[1024/682] w-full overflow-hidden">
          {/* Muted atmosphere */}
          <div
            className="pointer-events-none absolute inset-0 bg-contain bg-center bg-no-repeat opacity-[0.36] brightness-[0.97] saturate-[0.5]"
            style={{ backgroundImage: `url('${ART_SRC}')` }}
            aria-hidden
          />

          {/* Progressive node illuminations (CSS masks — no extra Next/Image copies) */}
          {STAGES.map((stage, i) => (
            <div
              key={stage.id}
              className="pointer-events-none absolute inset-0 bg-contain bg-center bg-no-repeat"
              style={{
                opacity: strengths[i],
                backgroundImage: `url('${ART_SRC}')`,
                WebkitMaskImage: `radial-gradient(circle 24% at ${stage.cx}% ${stage.cy}%, #000 0%, #000 38%, transparent 76%)`,
                maskImage: `radial-gradient(circle 24% at ${stage.cx}% ${stage.cy}%, #000 0%, #000 38%, transparent 76%)`,
              }}
              aria-hidden
            />
          ))}

          {/* Finale — full diagram in color */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ opacity: fullReveal }}
          >
            <Image
              src={ART_SRC}
              alt="Different lenses, same beautiful outcome — one shared truth across venue, couple, and vendor perspectives"
              width={1024}
              height={682}
              className="h-full w-full object-contain"
              sizes="(max-width:1200px) 100vw, 1200px"
            />
          </div>

          {/* Soft heart glow */}
          <div
            className="shared-truth-heart-glow pointer-events-none absolute left-1/2 top-[46%] h-[30%] w-[36%] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ opacity: finale * 0.9 }}
            aria-hidden
          />
        </div>

        {/* Caption slot under diagram (stacks cleanly on mobile) */}
        <div
          className="mx-auto mt-8 flex min-h-[3.25rem] max-w-md items-center justify-center px-2 text-center md:mt-10 md:min-h-[3.5rem]"
          aria-live="polite"
        >
          <p
            key={caption ?? "empty"}
            className={cn(
              "shared-truth-caption font-heading text-base italic leading-snug text-[var(--forest-sage)]/70 md:text-lg",
              caption ? "is-visible" : "is-hidden",
            )}
          >
            {caption ?? "\u00a0"}
          </p>
        </div>
      </div>
    </div>
  );
}
