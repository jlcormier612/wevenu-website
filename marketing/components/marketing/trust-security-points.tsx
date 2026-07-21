"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type SecurityPoint = {
  title: string;
  body: string;
};

/**
 * Trust Security items — one quiet entrance each (once).
 * Fade + 12px rise · ~400ms ease-out · 60ms stagger · prefers-reduced-motion.
 */
export function TrustSecurityPoints({ points }: { points: readonly SecurityPoint[] }) {
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
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="mt-16 space-y-10">
      {points.map((point, i) => (
        <div
          key={point.title}
          className={cn("trust-security-card", visible && "is-visible")}
          style={{ transitionDelay: visible ? `${i * 60}ms` : "0ms" }}
        >
          <h3 className="font-heading text-xl text-[var(--forest-sage)] md:text-2xl">
            {point.title}
          </h3>
          <p className="mt-3 max-w-[65ch] text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg">
            {point.body}
          </p>
        </div>
      ))}
    </div>
  );
}
