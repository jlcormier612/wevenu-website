"use client";

import { useEffect, useMemo, useState } from "react";

import { ProductJourneyChapter } from "@/components/marketing/product-journey-chapter";
import { ProductOpening } from "@/components/marketing/product-opening";
import { MarketingCta } from "@/components/marketing/marketing-cta";
import { ClosingCta } from "@/components/marketing/closing-cta";
import { Reveal } from "@/components/marketing/reveal";
import { PRODUCT_PAGE } from "@/lib/marketing/product-page";
import { PRODUCT_STORY, type ProductStoryId } from "@/lib/marketing/product-story";
import { HOVER_TAB, MOTION_HOVER } from "@/lib/marketing/rhythm";
import { cn } from "@/lib/utils";

type ChapterStatus = "active" | "past" | "upcoming";

/**
 * Product page — Sections 1–2 opening + approved seven-chapter Product Journey.
 * Deep magazine routes at /product/journey/[slug] remain available separately.
 */
export function ProductExperience() {
  const p = PRODUCT_PAGE;
  const [active, setActive] = useState<ProductStoryId>(PRODUCT_STORY[0].id);

  useEffect(() => {
    const nodes = PRODUCT_STORY.map((s) => ({
      id: s.id,
      el: document.getElementById(`ch-${s.id}`),
    })).filter((n): n is { id: ProductStoryId; el: HTMLElement } => Boolean(n.el));

    /** Reading line — aligned with prior rootMargin (~38% top) */
    const markerRatio = 0.38;

    function updateActive() {
      const markerY = window.innerHeight * markerRatio;
      let current: ProductStoryId = nodes[0]?.id ?? PRODUCT_STORY[0].id;

      for (const { id, el } of nodes) {
        if (el.getBoundingClientRect().top <= markerY) {
          current = id;
        }
      }

      setActive(current);
    }

    updateActive();
    window.addEventListener("scroll", updateActive, { passive: true });
    window.addEventListener("resize", updateActive, { passive: true });
    return () => {
      window.removeEventListener("scroll", updateActive);
      window.removeEventListener("resize", updateActive);
    };
  }, []);

  const activeIndex = useMemo(
    () => PRODUCT_STORY.findIndex((s) => s.id === active),
    [active],
  );

  const lineProgress =
    activeIndex <= 0
      ? 1 / PRODUCT_STORY.length
      : (activeIndex + 1) / PRODUCT_STORY.length;

  function statusFor(index: number): ChapterStatus {
    if (index === activeIndex) return "active";
    if (index < activeIndex) return "past";
    return "upcoming";
  }

  return (
    <div className="bg-[var(--true-white)]">
      {/* ── Sections 1–2: venue hero + connected client/vendor experiences ── */}
      <ProductOpening />

      {/* ── Product Journey introduction ── */}
      <section
        id="follow"
        className="product-journey-follow pj-intro scroll-mt-28 overflow-x-hidden border-t border-[var(--taupe-light)] px-6 pb-10 pt-14 md:pb-12 md:pt-16"
      >
        <div className="mx-auto min-w-0 max-w-7xl">
          <Reveal>
            <h2 className="pj-intro-headline pj-headline font-heading font-normal tracking-[-0.02em]">
              {p.journey.headline}
            </h2>
            <p className="pj-intro-support pj-body mx-auto max-w-[65ch] text-base leading-[1.7] md:text-lg">
              {p.journey.support}
            </p>
          </Reveal>

          <nav
            className="pj-intro-nav relative max-w-full min-w-0 overflow-x-auto overscroll-x-contain pb-2"
            aria-label="Product journey chapters"
          >
            <div
              className="pointer-events-none absolute left-0 right-0 top-0 h-px bg-[var(--taupe-medium)]/45"
              aria-hidden
            >
              <div
                className="journey-story-line h-full origin-left bg-[var(--heritage-sage)]/55"
                style={{ transform: `scaleX(${lineProgress})` }}
              />
            </div>
            <div className="flex flex-nowrap items-center justify-between gap-0">
              {PRODUCT_STORY.map((step, i) => {
                const status = statusFor(i);
                return (
                  <a
                    key={step.id}
                    href={`#ch-${step.id}`}
                    className={cn(
                      `shrink-0 px-1.5 py-2 text-[11px] tracking-wide whitespace-nowrap transition-[color,opacity] ${MOTION_HOVER} sm:px-2 sm:text-xs md:px-2.5`,
                      status === "active" && "pj-nav-active",
                      status === "past" && "pj-nav-past",
                      status === "upcoming" && `pj-nav-upcoming ${HOVER_TAB}`,
                    )}
                  >
                    {step.navTitle}
                  </a>
                );
              })}
            </div>
          </nav>
        </div>
      </section>

      {/* ── Seven-chapter journey ── */}
      <div
        id="connected-journey"
        className="product-journey-follow relative scroll-mt-28 px-6"
      >
        <div className="relative mx-auto max-w-6xl">
          <div
            className="pointer-events-none absolute inset-y-0 left-0 hidden w-px md:block"
            aria-hidden
          >
            <div className="absolute inset-0 bg-[var(--taupe-medium)]/35" />
            <div
              className="journey-story-line absolute inset-x-0 top-0 h-full origin-top bg-[var(--heritage-sage)]/50"
              style={{ transform: `scaleY(${lineProgress})` }}
            />
          </div>

          <div className="md:pl-10">
            {PRODUCT_STORY.map((step, i) => (
              <div key={step.id}>
                {step.act ? (
                  <p
                    className={cn(
                      "border-t border-[var(--taupe-medium)]/50 text-[0.7125rem] tracking-[0.22em] uppercase text-[var(--heritage-sage)]/82",
                      i === 0 ? "pt-8 md:pt-10" : "pt-10 md:pt-12",
                    )}
                  >
                    {step.act}
                  </p>
                ) : null}
                <ProductJourneyChapter
                  chapter={step}
                  index={i}
                  status={statusFor(i)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Closing CTA — preserved ── */}
      <section className="border-t border-[var(--taupe-light)] bg-[var(--linen)] px-6 py-28 md:py-36">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="font-heading text-[2.52rem] text-[var(--forest-sage)] md:text-[3.36rem]">
            {p.cta.headline}
          </h2>
          <div className="mt-8 space-y-3 text-base text-[var(--forest-sage)]/65 md:text-lg">
            {p.cta.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <div className="mt-12 flex justify-center">
            <ClosingCta label={p.cta.button} />
          </div>
          <p className="mt-8">
            <MarketingCta href="/" label="Back to Home" variant="ghost" />
          </p>
        </div>
      </section>
    </div>
  );
}
