import Image from "next/image";

import { MarketingCta } from "@/components/marketing/marketing-cta";
import { ProductMoment } from "@/components/marketing/product-moment";
import { VISION, VISION_PHOTO } from "@/lib/marketing/vision";

/**
 * Concept A — Editorial Magazine
 * High emotion, luxury hospitality. Spreads, pull quotes, departments.
 */
export function ConceptEditorial() {
  return (
    <div className="pb-24">
      {/* Masthead hero */}
      <section className="relative min-h-[92vh]">
        <Image
          src={VISION_PHOTO.estateGolden}
          alt="Historic estate at golden hour"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[rgba(40,48,40,0.48)]" />
        <div className="relative z-10 mx-auto flex min-h-[92vh] max-w-5xl flex-col justify-end px-6 pb-16 pt-40 text-[var(--true-white)]">
          <p className="font-script text-3xl md:text-4xl text-[var(--soft-sage)]">
            {VISION.understood.script}
          </p>
          <h1 className="mt-4 font-heading text-5xl font-medium leading-[1.05] tracking-tight md:text-7xl">
            {VISION.understood.headline}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-white/85 md:text-lg">
            {VISION.understood.body}
          </p>
          <div className="mt-10">
            <MarketingCta className="!bg-[var(--true-white)] !text-[var(--forest-sage)]" />
          </div>
        </div>
      </section>

      {/* Opening connected essay */}
      <section className="mx-auto max-w-3xl px-6 py-24 text-center md:py-32">
        <p className="text-xs tracking-[0.28em] uppercase text-[var(--heritage-sage)]">
          {VISION.connected.eyebrow}
        </p>
        <h2 className="mt-5 font-heading text-4xl font-medium text-[var(--forest-sage)] md:text-5xl">
          {VISION.connected.headline}
        </h2>
        <blockquote className="mt-12 space-y-4">
          {VISION.connected.continuum.map((line) => (
            <p
              key={line}
              className="font-heading text-xl leading-snug text-[var(--forest-sage)]/85 md:text-2xl"
            >
              {line}
            </p>
          ))}
        </blockquote>
        <p className="mt-10 text-sm tracking-wide text-[var(--forest-sage)]/55">
          {VISION.connected.proof}
        </p>
      </section>

      {/* Emotion spread */}
      <section className="grid md:grid-cols-2">
        <div className="relative min-h-[70vh]">
          <Image src={VISION_PHOTO.barnLuxury} alt="Luxury barn reception" fill className="object-cover" sizes="50vw" />
        </div>
        <div className="flex flex-col justify-center bg-[var(--linen)] px-10 py-20 md:px-16">
          <p className="font-script text-3xl text-[var(--heritage-sage)]">
            I wish every event looked like this.
          </p>
          <p className="mt-8 max-w-md text-base leading-relaxed text-[var(--forest-sage)]/75">
            Then Wevenu proves it is not another point solution — because one inquiry already
            becomes one booking, one planning experience, one guest experience, one celebration.
          </p>
          <div className="mt-10">
            <ProductMoment label="Venue workspace" />
          </div>
        </div>
      </section>

      {/* Platform overview as magazine departments */}
      <section className="mx-auto max-w-6xl px-6 py-24 md:py-32">
        <header className="mb-16 max-w-2xl">
          <p className="text-xs tracking-[0.28em] uppercase text-[var(--heritage-sage)]">
            Venue operations
          </p>
          <h2 className="mt-4 font-heading text-4xl font-medium text-[var(--forest-sage)] md:text-5xl">
            Everything you need for each part of running your venue.
          </h2>
        </header>
        <div className="space-y-24">
          {VISION.operations.map((op, i) => (
            <article
              key={op.id}
              className={`grid items-center gap-10 md:grid-cols-2 ${i % 2 === 1 ? "md:[&>div:first-child]:order-2" : ""}`}
            >
              <div className="relative aspect-[4/5] overflow-hidden">
                <Image src={op.photo} alt={op.title} fill className="object-cover" sizes="(max-width:768px) 100vw, 50vw" />
              </div>
              <div>
                <p className="text-xs tracking-[0.22em] uppercase text-[var(--heritage-sage)]">
                  {String(i + 1).padStart(2, "0")} · {op.title}
                </p>
                <h3 className="mt-3 font-heading text-3xl font-medium text-[var(--forest-sage)]">
                  {op.value}
                </h3>
                <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
                  {op.groups.map((g) => (
                    <li key={g} className="text-sm text-[var(--forest-sage)]/65">
                      {g}
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  <ProductMoment label={`${op.title} · product`} />
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Triad */}
      <section className="bg-[var(--heritage-sage)] px-6 py-24 text-[var(--true-white)] md:py-32">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-xs tracking-[0.28em] uppercase text-white/55">{VISION.triad.eyebrow}</p>
          <h2 className="mt-5 font-heading text-4xl font-medium md:text-6xl">{VISION.triad.headline}</h2>
          <p className="mx-auto mt-5 max-w-2xl text-base text-white/75">{VISION.triad.subhead}</p>
          <div className="mt-16 grid gap-10 md:grid-cols-3">
            {VISION.triad.parties.map((p) => (
              <div key={p.name} className="border-t border-white/25 pt-6 text-left">
                <h3 className="font-heading text-2xl">{p.name}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/70">{p.line}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Guest + Luv editorial */}
      <section className="mx-auto grid max-w-6xl gap-16 px-6 py-24 md:grid-cols-2 md:py-32">
        <div>
          <p className="font-script text-3xl text-[var(--heritage-sage)]">
            {VISION.guestExperience.script}
          </p>
          <h2 className="mt-3 font-heading text-3xl text-[var(--forest-sage)] md:text-4xl">
            {VISION.guestExperience.headline}
          </h2>
          <p className="mt-5 text-base leading-relaxed text-[var(--forest-sage)]/75">
            {VISION.guestExperience.body}
          </p>
          <div className="relative mt-8 aspect-[5/4] overflow-hidden">
            <Image src={VISION_PHOTO.greenhouse} alt="Glass greenhouse venue" fill className="object-cover" sizes="50vw" />
          </div>
        </div>
        <div>
          <p className="text-xs tracking-[0.28em] uppercase text-[var(--heritage-sage)]">
            {VISION.luv.eyebrow}
          </p>
          <h2 className="mt-3 font-heading text-3xl text-[var(--forest-sage)] md:text-4xl">
            {VISION.luv.headline}
          </h2>
          <div className="mt-5 space-y-3 text-base leading-relaxed text-[var(--forest-sage)]/75">
            <p>{VISION.luv.body}</p>
            {VISION.luv.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <div className="mt-8">
            <ProductMoment label="Luv · hospitality intelligence" />
          </div>
        </div>
      </section>

      {/* Closing desire + CTA */}
      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <p className="font-heading text-2xl italic text-[var(--forest-sage)]/80 md:text-3xl">
          “{VISION.closingDesire}”
        </p>
        <h2 className="mt-14 font-heading text-4xl text-[var(--forest-sage)]">{VISION.cta.headline}</h2>
        <p className="mt-4 text-[var(--forest-sage)]/70">{VISION.cta.body}</p>
        <div className="mt-8 flex justify-center">
          <MarketingCta />
        </div>
      </section>
    </div>
  );
}
