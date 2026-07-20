"use client";

import { useEffect, useRef, useState } from "react";

import { HospitalityHeart } from "@/components/marketing/brand-accents";
import { cn } from "@/lib/utils";

type LuvQuietMomentProps = {
  /** Eyebrow beside the heart — default Meet Luv. */
  name?: string;
  className?: string;
};

/**
 * Quiet delight for Luv — Hospitality heart, then a gentle suggestion.
 * Never a chatbot or interrupt.
 */
export function LuvQuietMoment({
  name = "Meet Luv.",
  className,
}: LuvQuietMomentProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35, rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={cn(className)}>
      <p className="flex items-center gap-2.5 text-[0.7125rem] tracking-[0.22em] uppercase text-[var(--heritage-sage)]/82">
        <span>{name}</span>
        <span
          className={cn("luv-heart inline-flex", visible && "is-visible")}
          aria-hidden
        >
          <HospitalityHeart size={14} className="!opacity-100" />
        </span>
      </p>
      <p
        className={cn(
          "luv-whisper mt-5 max-w-md font-heading text-lg italic leading-snug text-[var(--forest-sage)]/55 md:text-xl",
          visible && "is-visible",
        )}
      >
        Here&apos;s something that may deserve your attention…
      </p>
    </div>
  );
}
