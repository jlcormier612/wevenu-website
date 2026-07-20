"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { ClosingCta } from "@/components/marketing/closing-cta";
import { MarketingCta } from "@/components/marketing/marketing-cta";
import { ProductMoment } from "@/components/marketing/product-moment";
import { EDITORIAL_FRAME, EDITORIAL_IMAGE, EDITORIAL_IMAGE_UI, HOVER_TAB } from "@/lib/marketing/rhythm";
import { VISION, VISION_PHOTO } from "@/lib/marketing/vision";
import { cn } from "@/lib/utils";

const STEP_PHOTOS = [
  VISION_PHOTO.estateGolden,
  VISION_PHOTO.gardenCeremony,
  VISION_PHOTO.architectureStone,
  VISION_PHOTO.barnLuxury,
  VISION_PHOTO.candleTablescape,
  VISION_PHOTO.greenhouse,
  VISION_PHOTO.receptionWarm,
  VISION_PHOTO.flowersDetail,
  VISION_PHOTO.vineyardDusk,
  VISION_PHOTO.coastal,
  VISION_PHOTO.barnLuxury,
  VISION_PHOTO.estateGolden,
  VISION_PHOTO.receptionWarm,
] as const;

/**
 * Concept C — Interactive Booking Journey
 * Sticky journey rail; homepage follows one booking emotion → proof.
 */
export function ConceptJourney() {
  const [active, setActive] = useState<string>(VISION.journey[0].id);

  useEffect(() => {
    const nodes = VISION.journey
      .map((s) => document.getElementById(`journey-${s.id}`))
      .filter(Boolean) as HTMLElement[];

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) {
          setActive(visible.target.id.replace("journey-", ""));
        }
      },
      { rootMargin: "-35% 0px -45% 0px", threshold: [0.2, 0.5, 0.8] },
    );

    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="pb-24">
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-28 md:py-36">
        <p className="font-script text-3xl text-[var(--heritage-sage)] md:text-4xl">
          Follow one booking.
        </p>
        <h1 className="mt-4 max-w-3xl font-heading text-[3.36rem] font-medium leading-[1.1] text-[var(--forest-sage)] md:text-[4.2rem]">
          From first inquiry to final celebration — connected, not integrated.
        </h1>
        <p className="mt-6 max-w-xl text-base leading-[1.7] text-[var(--forest-sage)]/70">
          {VISION.understood.body}
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <MarketingCta />
          <MarketingCta
            href={`#journey-${VISION.journey[0].id}`}
            label="Begin the journey"
            variant="ghost"
          />
        </div>
      </section>

      {/* Connected preamble */}
      <section className="border-y border-[var(--taupe-light)] bg-[var(--linen)] px-6 py-28 md:py-36">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs tracking-[0.24em] uppercase text-[var(--heritage-sage)]">
            {VISION.connected.eyebrow}
          </p>
          <p className="mt-4 font-heading text-2xl text-[var(--forest-sage)] md:text-3xl">
            {VISION.connected.headline}
          </p>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-28 md:py-36 lg:grid-cols-[220px_1fr]">
        {/* Sticky rail */}
        <aside className="hidden lg:block">
          <nav className="sticky top-36 space-y-1" aria-label="Booking journey">
            {VISION.journey.map((step, i) => (
              <a
                key={step.id}
                href={`#journey-${step.id}`}
                className={cn(
                  "block border-l-2 py-2 pl-4 text-sm transition duration-200 ease-out",
                  active === step.id
                    ? "border-[var(--heritage-sage)] text-[var(--forest-sage)]"
                    : `border-transparent text-[var(--forest-sage)]/40 ${HOVER_TAB}`,
                )}
              >
                <span className="mr-2 text-xs tracking-widest text-[var(--heritage-sage)]/70">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {step.title}
              </a>
            ))}
          </nav>
        </aside>

        {/* Steps */}
        <div className="space-y-24 md:space-y-32">
          {VISION.journey.map((step, i) => (
            <article
              key={step.id}
              id={`journey-${step.id}`}
              className="scroll-mt-36"
            >
              <p className="text-[0.7125rem] tracking-[0.22em] uppercase text-[var(--heritage-sage)]/82">
                Step {String(i + 1).padStart(2, "0")}
              </p>
              <h2 className="mt-2 font-heading text-[2.52rem] text-[var(--forest-sage)]">{step.title}</h2>
              <p className="mt-3 font-script text-2xl text-[var(--heritage-sage)]">
                {step.emotion}
              </p>
              <div className="mt-8 grid gap-6 md:grid-cols-2">
                <div className={`relative aspect-[4/5] ${EDITORIAL_FRAME}`}>
                  <Image
                    src={STEP_PHOTOS[i] ?? VISION_PHOTO.estateGolden}
                    alt={step.title}
                    fill
                    className={EDITORIAL_IMAGE}
                    sizes="(max-width:768px) 100vw, 40vw"
                  />
                </div>
                <ProductMoment label={`${step.title} · product moment`} />
              </div>
              {i < VISION.journey.length - 1 ? (
                <p className="mt-8 text-sm tracking-wide text-[var(--forest-sage)]/45">
                  Continues → {VISION.journey[i + 1].title}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      </div>

      {/* Ecosystem after journey */}
      <section className="bg-[var(--heritage-sage)] px-6 py-28 text-[var(--true-white)] md:py-36">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-heading text-[2.52rem] md:text-[3.36rem]">{VISION.triad.headline}</h2>
          <p className="mt-4 max-w-2xl text-white/75">{VISION.triad.subhead}</p>
          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {VISION.triad.parties.map((p) => (
              <div key={p.name} className="border border-white/20 p-6">
                <h3 className="font-heading text-2xl">{p.name}</h3>
                <p className="mt-3 text-sm text-white/70">{p.line}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Luv */}
      <section className="mx-auto max-w-5xl px-6 py-28 md:py-36">
        <p className="font-script text-3xl text-[var(--heritage-sage)]">
          {VISION.luv.eyebrow}
        </p>
        <h2 className="mt-3 font-heading text-[2.52rem] text-[var(--forest-sage)]">{VISION.luv.headline}</h2>
        <div className="mt-5 max-w-2xl space-y-3 text-[var(--forest-sage)]/75">
          <p>{VISION.luv.body}</p>
          {VISION.luv.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <div className="mt-10 max-w-3xl">
          <ProductMoment label="Luv · included with the platform" />
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-28 text-center md:py-36">
        <p className="font-heading text-2xl italic text-[var(--forest-sage)]/80 md:text-3xl">
          “{VISION.closingDesire}”
        </p>
        <h2 className="mt-12 font-heading text-[2.52rem] text-[var(--forest-sage)]">{VISION.cta.headline}</h2>
        <p className="mt-4 text-[var(--forest-sage)]/70">{VISION.cta.body}</p>
        <div className="mt-8 flex justify-center">
          <ClosingCta />
        </div>
      </section>
    </div>
  );
}
