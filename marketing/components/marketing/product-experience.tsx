"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ProductJourneyChapter } from "@/components/marketing/product-journey-chapter";
import { MarketingCta } from "@/components/marketing/marketing-cta";
import { FILM } from "@/lib/marketing/film";
import { PRODUCT_JOURNEY, PRODUCT_PAGE } from "@/lib/marketing/product-page";
import { cn } from "@/lib/utils";

/**
 * Product page — how Wevenu works.
 * Home holds belief; this page holds the connected booking story.
 */
export function ProductExperience() {
  const p = PRODUCT_PAGE;
  const [active, setActive] = useState<string>(PRODUCT_JOURNEY[0].id);

  useEffect(() => {
    const nodes = PRODUCT_JOURNEY.map((s) => document.getElementById(`ch-${s.id}`)).filter(
      Boolean,
    ) as HTMLElement[];

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActive(visible.target.id.replace("ch-", ""));
      },
      { rootMargin: "-40% 0px -45% 0px", threshold: [0.15, 0.4, 0.7] },
    );

    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, []);

  const actBefore = Object.fromEntries(p.storyActs.map((a) => [a.beforeId, a.label]));

  return (
    <div className="bg-[var(--true-white)]">
      {/* ── Hero ── */}
      <section className="bg-[var(--true-white)] px-6 pt-[140px] pb-[100px]">
        <div className="mx-auto max-w-[700px]">
          <p className="text-xs tracking-[0.18em] uppercase text-[var(--heritage-sage)]">
            {p.hero.eyebrow}
          </p>
          <h1 className="mt-6 max-w-[650px] font-heading text-[2.75rem] font-medium leading-[1.05] tracking-tight text-[var(--forest-sage)] whitespace-pre-line md:text-[72px]">
            {p.hero.headline}
          </h1>
          <div className="mt-8 max-w-[620px] space-y-5 text-base leading-relaxed text-[var(--forest-sage)]/75 md:text-lg">
            <p>{p.hero.body}</p>
            <p>{p.hero.bodySecondary}</p>
          </div>
          <div className="mt-12 flex flex-wrap items-center gap-4">
            <MarketingCta label={p.hero.primaryCta} />
            <MarketingCta
              href="#follow"
              label={p.hero.secondaryCta}
              variant="secondary"
            />
          </div>
        </div>
      </section>

      {/* ── Follow one booking ── */}
      <section id="follow" className="scroll-mt-28 px-6 pb-16 md:pb-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs tracking-[0.22em] uppercase text-[var(--heritage-sage)]">
            {p.journey.eyebrow}
          </p>
          <h2 className="mt-5 max-w-2xl font-heading text-3xl text-[var(--forest-sage)] md:text-5xl">
            {p.journey.headline}
          </h2>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-[var(--forest-sage)]/70 md:text-lg">
            {p.journey.support}
          </p>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-[var(--forest-sage)]/55 md:text-base">
            {p.journey.exploreHint}
          </p>

          <div className="relative mt-14 aspect-[16/10] w-full overflow-hidden md:mt-16 md:aspect-[2.2/1]">
            <Image
              src={FILM.emptyChairs}
              alt="Reception waiting under warm string lights — one continuous celebration beginning"
              fill
              className="object-cover object-[center_40%]"
              sizes="100vw"
              priority
            />
          </div>

          <nav
            className="mt-16 flex gap-1 overflow-x-auto border-t border-[var(--taupe-medium)]/50 pt-8 pb-2 md:flex-wrap md:justify-center md:gap-2"
            aria-label="Booking chapters"
          >
            {PRODUCT_JOURNEY.map((step) => (
              <a
                key={step.id}
                href={`#ch-${step.id}`}
                className={cn(
                  "shrink-0 px-3 py-2 text-xs tracking-wide transition md:px-4",
                  active === step.id
                    ? "text-[var(--forest-sage)]"
                    : "text-[var(--forest-sage)]/45 hover:text-[var(--forest-sage)]/70",
                )}
              >
                {step.title}
              </a>
            ))}
          </nav>
        </div>
      </section>

      {/* ── Journey chapters ── */}
      {PRODUCT_JOURNEY.map((step, i) => (
        <div key={step.id}>
          {actBefore[step.id] ? (
            <div className="px-6 pt-8 md:pt-12">
              <p className="mx-auto max-w-6xl border-t border-[var(--taupe-medium)]/50 pt-14 font-heading text-sm tracking-[0.18em] uppercase text-[var(--heritage-sage)]/70 md:pt-20 md:text-base">
                {actBefore[step.id]}
              </p>
            </div>
          ) : null}
          <ProductJourneyChapter
            id={step.id}
            index={i}
            title={step.title}
            emotion={step.emotion}
            body={step.body}
            reverse={i % 2 === 1}
          />
        </div>
      ))}

      {/* ── Closing CTA — distinct from Home ── */}
      <section className="border-t border-[var(--taupe-light)] bg-[var(--linen)] px-6 py-32 md:py-40">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="font-heading text-4xl text-[var(--forest-sage)] md:text-5xl">
            {p.cta.headline}
          </h2>
          <div className="mt-8 space-y-3 text-base text-[var(--forest-sage)]/65 md:text-lg">
            {p.cta.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <div className="mt-12 flex justify-center">
            <MarketingCta label={p.cta.button} />
          </div>
          <p className="mt-8">
            <Link
              href="/"
              className="text-sm tracking-wide text-[var(--forest-sage)]/50 underline-offset-4 hover:underline"
            >
              Back to Home
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
