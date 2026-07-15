import Image from "next/image";

import { MarketingCta } from "@/components/marketing/marketing-cta";
import { ProductMoment } from "@/components/marketing/product-moment";
import { VISION, VISION_PHOTO } from "@/lib/marketing/vision";

/**
 * Concept B — Immersive Keynote
 * One idea per viewport. Giant type. Monumental product moments.
 */
export function ConceptImmersive() {
  return (
    <div className="bg-[var(--forest-sage)] text-[var(--true-white)]">
      {/* Beat 1 */}
      <section className="flex min-h-[100svh] flex-col justify-center px-6">
        <div className="mx-auto max-w-5xl">
          <p className="font-script text-3xl text-[var(--soft-sage)] md:text-5xl">
            {VISION.understood.script}
          </p>
          <h1 className="mt-6 font-heading text-6xl font-medium leading-[0.95] tracking-tight md:text-8xl lg:text-9xl">
            {VISION.understood.headline}
          </h1>
          <div className="mt-12">
            <MarketingCta className="!bg-[var(--soft-sage)] !text-[var(--forest-sage)]" />
          </div>
        </div>
      </section>

      {/* Beat 2 — emotion full bleed */}
      <section className="relative min-h-[100svh]">
        <Image src={VISION_PHOTO.coastal} alt="Coastal venue" fill className="object-cover" sizes="100vw" />
        <div className="absolute inset-0 bg-black/35" />
        <p className="absolute bottom-16 left-6 right-6 mx-auto max-w-4xl font-heading text-4xl leading-tight md:text-6xl">
          I wish every event looked like this.
        </p>
      </section>

      {/* Beat 3 — connected */}
      <section className="flex min-h-[100svh] flex-col justify-center px-6">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs tracking-[0.3em] uppercase text-white/45">{VISION.connected.eyebrow}</p>
          <h2 className="mt-6 font-heading text-5xl font-medium leading-[1.05] md:text-7xl">
            {VISION.connected.headline}
          </h2>
          <ul className="mt-14 space-y-5">
            {VISION.connected.continuum.map((line) => (
              <li key={line} className="border-t border-white/15 pt-5 text-lg text-white/80 md:text-2xl">
                {line}
              </li>
            ))}
          </ul>
          <p className="mt-12 text-sm tracking-wide text-white/45">{VISION.connected.proof}</p>
        </div>
      </section>

      {/* Beat 4 — giant product */}
      <section className="flex min-h-[100svh] flex-col justify-center bg-[var(--heritage-sage)] px-4 py-20 md:px-10">
        <p className="mb-8 text-center text-xs tracking-[0.28em] uppercase text-white/50">
          Proof · Venue workspace
        </p>
        <div className="mx-auto w-full max-w-6xl overflow-hidden border border-white/10">
          <div className="relative aspect-[16/10] w-full">
            <Image
              src={VISION_PHOTO.dashboard}
              alt="Wevenu product"
              fill
              className="object-cover object-top"
              sizes="100vw"
            />
          </div>
        </div>
      </section>

      {/* Beat 5 — operations as sparse statements */}
      {VISION.operations.slice(0, 5).map((op) => (
        <section key={op.id} className="grid min-h-[100svh] md:grid-cols-2">
          <div className="relative min-h-[50vh] md:min-h-full">
            <Image src={op.photo} alt={op.title} fill className="object-cover" sizes="50vw" />
          </div>
          <div className="flex flex-col justify-center px-8 py-16 md:px-16">
            <p className="text-xs tracking-[0.28em] uppercase text-white/45">{op.title}</p>
            <h2 className="mt-4 font-heading text-4xl font-medium leading-tight md:text-5xl">
              {op.value}
            </h2>
            <p className="mt-6 text-sm text-white/55">{op.groups.join(" · ")}</p>
          </div>
        </section>
      ))}

      {/* Beat 6 — triad monumental */}
      <section className="flex min-h-[100svh] flex-col justify-center px-6">
        <div className="mx-auto max-w-5xl text-center">
          <p className="font-script text-4xl text-[var(--soft-sage)]">
            {VISION.triad.headline}
          </p>
          <p className="mt-6 text-lg text-white/70 md:text-xl">{VISION.triad.subhead}</p>
          <div className="mt-20 grid gap-12 md:grid-cols-3">
            {VISION.triad.parties.map((p) => (
              <div key={p.name}>
                <h3 className="font-heading text-4xl md:text-5xl">{p.name}</h3>
                <p className="mt-4 text-sm text-white/60">{p.line}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Beat 7 — Luv launch */}
      <section className="grid min-h-[100svh] bg-[var(--natural-cream)] text-[var(--forest-sage)] md:grid-cols-2">
        <div className="flex flex-col justify-center px-8 py-20 md:px-16">
          <p className="font-script text-4xl text-[var(--heritage-sage)]">
            {VISION.luv.eyebrow}
          </p>
          <h2 className="mt-4 font-heading text-4xl font-medium md:text-6xl">{VISION.luv.headline}</h2>
          <div className="mt-6 max-w-md space-y-3 text-base leading-relaxed text-[var(--forest-sage)]/75">
            <p>{VISION.luv.body}</p>
            {VISION.luv.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
        <div className="flex items-center bg-[var(--linen)] px-6 py-12">
          <ProductMoment label="Luv notices" className="w-full" />
        </div>
      </section>

      {/* Beat 8 — closing */}
      <section className="flex min-h-[90svh] flex-col items-center justify-center px-6 text-center">
        <p className="max-w-3xl font-heading text-3xl italic leading-snug text-white/85 md:text-5xl">
          “{VISION.closingDesire}”
        </p>
        <h2 className="mt-16 font-heading text-4xl md:text-5xl">{VISION.cta.headline}</h2>
        <p className="mt-4 max-w-md text-white/60">{VISION.cta.body}</p>
        <div className="mt-10">
          <MarketingCta className="!bg-[var(--soft-sage)] !text-[var(--forest-sage)]" />
        </div>
      </section>
    </div>
  );
}
