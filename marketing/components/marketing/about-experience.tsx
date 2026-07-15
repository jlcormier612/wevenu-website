import Image from "next/image";

import { MarketingCta } from "@/components/marketing/marketing-cta";
import { UiPlaceholder } from "@/components/marketing/ui-placeholder";
import { ABOUT_PAGE } from "@/lib/marketing/about-page";
import { FILM } from "@/lib/marketing/film";

/**
 * About Wevenu — trust page.
 * Hero is the venue owner. Calm, honest, never corporate.
 */
export function AboutExperience() {
  const a = ABOUT_PAGE;

  return (
    <div className="bg-[var(--true-white)]">
      {/* ── Section 1 · The Why ── */}
      <section className="bg-[var(--true-white)] px-6 pt-[140px] pb-20 md:pb-[100px]">
        <div className="mx-auto max-w-[700px] text-center">
          <p className="text-xs tracking-[0.18em] uppercase text-[var(--heritage-sage)]">
            {a.why.eyebrow}
          </p>
          <h1 className="mt-6 font-heading text-[2.5rem] font-medium leading-[1.08] tracking-tight text-[var(--forest-sage)] whitespace-pre-line md:text-[56px] lg:text-[64px]">
            {a.why.headline}
          </h1>
          <div className="mx-auto mt-10 max-w-[560px] space-y-5 text-base leading-relaxed text-[var(--forest-sage)]/75 md:text-lg">
            {a.why.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          <div className="mt-12 flex justify-center">
            <MarketingCta label={a.why.cta} />
          </div>
        </div>
        <div className="relative mx-auto mt-16 aspect-[16/10] max-w-5xl overflow-hidden md:mt-20 md:aspect-[21/9]">
          <Image
            src={FILM.aboutCare}
            alt="Ceremony seats dressed and waiting — quiet care before guests arrive"
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 1024px"
            priority
          />
        </div>
      </section>

      {/* ── Section 2 · What We Saw ── */}
      <section className="bg-[var(--warm-gray)] px-6 py-24 md:py-32">
        <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2 md:gap-16">
          <div>
            <h2 className="font-heading text-3xl font-medium leading-[1.1] text-[var(--forest-sage)] whitespace-pre-line md:text-4xl lg:text-5xl">
              {a.whatWeSaw.headline}
            </h2>
            <div className="mt-8 max-w-md space-y-4 text-base leading-relaxed text-[var(--forest-sage)]/75">
              {a.whatWeSaw.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </div>
          <div className="relative aspect-[4/5] overflow-hidden md:aspect-[3/4]">
            <Image
              src={FILM.aboutPlanning}
              alt="Long table set in quiet morning light — place cards, florals, and thoughtful hospitality"
              fill
              className="object-cover"
              sizes="50vw"
            />
          </div>
        </div>
      </section>

      {/* ── Section 3 · Our Belief ── */}
      <section className="flex min-h-[560px] items-center bg-[var(--true-white)] px-6 py-28 md:py-36">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-medium leading-[1.1] text-[var(--forest-sage)] md:text-5xl">
            {a.belief.headline}
          </h2>
          <div className="mt-10 space-y-5 text-base leading-relaxed text-[var(--forest-sage)]/75 md:text-lg">
            {a.belief.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 4 · How We Built Wevenu ── */}
      <section className="bg-[var(--true-white)] px-6 py-24 md:py-32">
        <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2 md:gap-16">
          <UiPlaceholder
            moment="One living record"
            capture="Workspace screenshot — inquiry through guest experience on a single connected record. Large, beautiful, readable."
            aspect="tall"
            className="min-h-[400px] md:min-h-[520px]"
          />
          <div className="flex flex-col justify-center">
            <p className="text-xs tracking-[0.22em] uppercase text-[var(--heritage-sage)]">
              {a.howWeBuilt.eyebrow}
            </p>
            <h2 className="mt-4 font-heading text-3xl font-medium text-[var(--forest-sage)] whitespace-pre-line md:text-5xl">
              {a.howWeBuilt.headline}
            </h2>
            <div className="mt-8 max-w-md space-y-4 text-base leading-relaxed text-[var(--forest-sage)]/75">
              {a.howWeBuilt.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 5 · Our Promise ── */}
      <section className="bg-[var(--heritage-sage)] px-6 py-28 text-[var(--true-white)] md:py-36">
        <div className="mx-auto max-w-2xl text-center md:max-w-3xl">
          <h2 className="font-heading text-3xl font-medium leading-[1.1] whitespace-pre-line md:text-5xl">
            {a.promise.headline}
          </h2>
          <div className="mt-10 space-y-4 text-base leading-relaxed text-white/75 md:text-lg">
            {a.promise.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 6 · Meet Luv ── */}
      <section className="bg-[var(--true-white)] px-6 py-[120px]">
        <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2 md:gap-16">
          <div className="flex flex-col justify-center">
            <h2 className="font-heading text-3xl font-medium text-[var(--forest-sage)] md:text-4xl lg:text-5xl">
              {a.luv.headline}
            </h2>
            <div className="mt-8 max-w-md space-y-4 text-base leading-relaxed text-[var(--forest-sage)]/75">
              {a.luv.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </div>
          <UiPlaceholder
            moment="Luv in the workspace"
            capture="Screenshot showing Luv — gentle notices, recommendations, hospitality first."
            aspect="tall"
          />
        </div>
      </section>

      {/* ── Section 7 · Who We Build For ── */}
      <section className="flex min-h-[480px] items-center bg-[var(--true-white)] px-6 py-28 md:py-32">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-medium text-[var(--forest-sage)] md:text-5xl">
            {a.who.headline}
          </h2>
          <div className="mt-10 space-y-5 text-base leading-relaxed text-[var(--forest-sage)]/75 md:text-lg">
            {a.who.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </div>
      </section>

      {/* ── Interstitial · one thought ── */}
      <section className="flex min-h-[420px] items-center bg-[var(--true-white)] px-6 py-24 md:min-h-[520px]">
        <p className="mx-auto max-w-[700px] text-center font-heading text-[2.5rem] font-medium leading-[1.15] text-[var(--forest-sage)] whitespace-pre-line md:text-[72px]">
          {a.interstitial.line}
        </p>
      </section>

      {/* ── Section 8 · The Invitation ── */}
      <section className="bg-[var(--true-white)] px-6 py-32 md:py-40">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="font-heading text-4xl text-[var(--forest-sage)] md:text-5xl">
            {a.invitation.headline}
          </h2>
          <div className="mt-10 space-y-4 text-base leading-relaxed text-[var(--forest-sage)]/70 md:text-lg">
            {a.invitation.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          <div className="mt-12 flex justify-center">
            <MarketingCta label={a.invitation.cta} />
          </div>
        </div>
      </section>
    </div>
  );
}
