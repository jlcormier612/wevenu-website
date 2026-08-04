"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { HospitalityHeart } from "@/components/marketing/brand-accents";
import { WalkthroughCtas } from "@/components/marketing/marketing-cta";
import { cn } from "@/lib/utils";

type ClosingCtaProps = {
  children?: ReactNode;
  /** Passed to default walkthrough CTA when children omitted */
  label?: string;
  className?: string;
};

/**
 * End-of-page finishing note — Hospitality heart with a soft glow.
 * Quiet story ending — never confetti.
 */
export function ClosingCta({ children, label, className }: ClosingCtaProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [lit, setLit] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setLit(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setLit(true);
          observer.disconnect();
        }
      },
      { threshold: 0.45, rootMargin: "0px 0px -6% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn("flex flex-col items-center", className)}
    >
      <span
        className={cn("story-end-heart inline-flex", lit && "is-lit")}
        aria-hidden
      >
        <HospitalityHeart size={16} className="!opacity-100" />
      </span>
      <div className="mt-5">
        {children ?? (
          <WalkthroughCtas
            className="justify-center"
            walkthroughLabel={label}
          />
        )}
      </div>
    </div>
  );
}
