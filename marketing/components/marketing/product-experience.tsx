"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { ProductJourneyChapter } from "@/components/marketing/product-journey-chapter";
import { CelebrationWhisper } from "@/components/marketing/brand-accents";
import { MarketingCta, WalkthroughCtas } from "@/components/marketing/marketing-cta";
import { ClosingCta } from "@/components/marketing/closing-cta";
import { Reveal } from "@/components/marketing/reveal";
import { FILM } from "@/lib/marketing/film";
import { PRODUCT_JOURNEY, PRODUCT_PAGE } from "@/lib/marketing/product-page";
import type { ProductJourneyId } from "@/lib/marketing/journey";
import { EDITORIAL_FRAME, EDITORIAL_IMAGE, HOVER_TAB, MOTION_HOVER } from "@/lib/marketing/rhythm";
import { cn } from "@/lib/utils";

type ChapterStatus = "active" | "past" | "upcoming";

/**
 * Product page — how Hello to Cheers works.
 * Home holds belief; this page holds the connected booking story.
 *
 * SEND 5 — Follow One Celebration: current chapter softly lit,
 * prior chapters ease back, thin line draws the continuous story.
 */
export function ProductExperience() {
  const p = PRODUCT_PAGE;
  const [active, setActive] = useState<ProductJourneyId>(PRODUCT_JOURNEY[0].id);

  useEffect(() => {
    const nodes = PRODUCT_JOURNEY.map((s) => ({
      id: s.id,
      el: document.getElementById(`ch-${s.id}`),
    })).filter((n): n is { id: ProductJourneyId; el: HTMLElement } => Boolean(n.el));

    /** Reading line — aligned with prior rootMargin (-38% top) */
    const markerRatio = 0.38;

    function updateActive() {
      const markerY = window.innerHeight * markerRatio;
      let current: ProductJourneyId = nodes[0]?.id ?? PRODUCT_JOURNEY[0].id;

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
    () => PRODUCT_JOURNEY.findIndex((s) => s.id === active),
    [active],
  );

  /** Line progress: reaches full at the final chapter */
  const lineProgress =
    activeIndex <= 0
      ? 1 / PRODUCT_JOURNEY.length
      : (activeIndex + 1) / PRODUCT_JOURNEY.length;

  const actBefore = Object.fromEntries(
    p.storyActs.map((a) => [a.beforeId, a.label]),
  );

  function statusFor(index: number): ChapterStatus {
    if (index === activeIndex) return "active";
    if (index < activeIndex) return "past";
    return "upcoming";
  }

  return (
    <div className="bg-[var(--true-white)]">
      {/* ── Hero ── */}
      <section className="bg-[var(--true-white)] px-6 pt-[140px] pb-28 md:pb-36">
        <div className="mx-auto max-w-[65ch]">
          <p className="text-[0.7125rem] tracking-[0.22em] uppercase text-[var(--heritage-sage)]/82">
            {p.hero.eyebrow}
          </p>
          <p className="mt-8 font-heading text-2xl leading-snug text-[var(--forest-sage)]/80 md:text-3xl">
            {p.hero.chapterTitle}
          </p>
          <h1 className="mt-8 max-w-[65ch] font-heading text-[3.08rem] font-medium leading-[1.1] tracking-tight text-[var(--forest-sage)] whitespace-pre-line md:text-[80.64px]">
            {p.hero.headline}
          </h1>
          <div className="mt-8 max-w-[65ch] space-y-5 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg">
            <p>{p.hero.body}</p>
            <p>{p.hero.bodySecondary}</p>
          </div>
          <WalkthroughCtas className="mt-12" walkthroughLabel={p.hero.primaryCta}>
            <MarketingCta
              href="#follow"
              label={p.hero.secondaryCta}
              variant="ghost"
            />
          </WalkthroughCtas>
        </div>
      </section>

      {/* ── Architecture overview ── */}
      <section className="px-6 pb-28 md:pb-36">
        <div className="mx-auto max-w-[1200px]">
          <h2 className="max-w-5xl font-heading text-[2.1rem] text-[var(--forest-sage)] md:text-[3.36rem]">
            Every relationship becomes one connected celebration.
          </h2>
          <div className="mx-auto mt-14 md:mt-16">
            <Image
              src="/marketing/product-architecture-overview.png"
              alt="One Event. Three Experiences. One Shared Truth — architecture overview for venues, couples, and vendors"
              width={682}
              height={1024}
              className="mx-auto h-auto w-full object-contain"
              sizes="(max-width:1200px) 100vw, 1200px"
            />
          </div>
        </div>
      </section>

      {/* ── Follow one booking ── */}
      <section id="follow" className="scroll-mt-28 px-6 pb-28 md:pb-36">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="text-[0.7125rem] tracking-[0.22em] uppercase text-[var(--heritage-sage)]/82">
              {p.journey.eyebrow}
            </p>
            <h2 className="mt-7 max-w-5xl font-heading text-[2.1rem] text-[var(--forest-sage)] md:text-[3.36rem]">
              {p.journey.headline}
            </h2>
            <p className="mt-6 max-w-[65ch] text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg">
              {p.journey.support}
            </p>
            <p className="mt-4 max-w-4xl text-sm leading-[1.7] text-[var(--forest-sage)]/55 md:text-base">
              {p.journey.exploreHint}
            </p>
          </Reveal>

          <div
            className={`relative mt-14 aspect-[16/10] w-full md:mt-16 md:aspect-[2.2/1] ${EDITORIAL_FRAME}`}
          >
            <Image
              src={FILM.productJourneyOpen}
              alt="A celebration table prepared in warm light — one continuous story beginning"
              fill
              className={EDITORIAL_IMAGE}
              sizes="100vw"
              priority
            />
            <CelebrationWhisper />
          </div>

          <nav
            className="relative mt-16 overflow-x-auto pt-8 pb-2"
            aria-label="Booking chapters"
          >
            {/* Thin story line under chapter titles */}
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
              {PRODUCT_JOURNEY.map((step, i) => {
                const status = statusFor(i);
                return (
                  <a
                    key={step.id}
                    href={`#ch-${step.id}`}
                    className={cn(
                      `shrink-0 px-1.5 py-2 text-[11px] tracking-wide whitespace-nowrap transition-[color,opacity] ${MOTION_HOVER} sm:px-2 sm:text-xs md:px-2.5`,
                      status === "active" && "text-[var(--forest-sage)]",
                      status === "past" && "text-[var(--forest-sage)]/40",
                      status === "upcoming" &&
                        `text-[var(--forest-sage)]/45 ${HOVER_TAB}`,
                    )}
                  >
                    {step.title}
                  </a>
                );
              })}
            </div>
          </nav>
        </div>
      </section>

      {/* ── Journey chapters — one continuous story ── */}
      <div id="connected-journey" className="relative scroll-mt-28 px-6">
        <div className="relative mx-auto max-w-6xl">
          {/* Vertical connecting line — grows with reading position */}
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
            {PRODUCT_JOURNEY.map((step, i) => (
              <div key={step.id}>
                {actBefore[step.id] ? (
                  <p className="border-t border-[var(--taupe-medium)]/50 pt-10 text-[0.7125rem] tracking-[0.22em] uppercase text-[var(--heritage-sage)]/82 md:pt-12">
                    {actBefore[step.id]}
                  </p>
                ) : null}
                <ProductJourneyChapter
                  id={step.id}
                  index={i}
                  title={step.title}
                  emotion={step.emotion}
                  body={step.body}
                  status={statusFor(i)}
                  reverse={
                    step.id === "contract-inventory" ? false : i % 2 === 1
                  }
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Closing CTA — distinct from Home ── */}
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
