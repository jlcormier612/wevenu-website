import Image from "next/image";
import Link from "next/link";

import { MarketingCta } from "@/components/marketing/marketing-cta";
import { OurFirstFriends } from "@/components/marketing/our-first-friends";
import { FILM } from "@/lib/marketing/film";
import { WHY_WEVENU } from "@/lib/marketing/why-wevenu";

/**
 * Why Wevenu — editorial belief chapter.
 * Unique purpose: why this company exists. Never repeats Home.
 */
export function WhyWevenuExperience() {
  const page = WHY_WEVENU;

  return (
    <div className="bg-[var(--true-white)]">
      {/* ── Opening — belief, not Home ── */}
      <section className="px-6 pb-24 pt-[140px] md:pb-32 md:pt-36">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs tracking-[0.22em] uppercase text-[var(--heritage-sage)]">
            {page.opening.eyebrow}
          </p>
          <div className="mt-10 space-y-6 md:mt-12 md:space-y-7">
            {page.opening.lines.map((line, i) => {
              const isLead = i < 2;
              const isBeliefClose = line === "Belief.";
              const isQuestion = line.startsWith('"Does this');
              const isHumanLine =
                line === "Relationships." ||
                line === "Trust." ||
                line === "Presence." ||
                line === "Care.";

              return (
                <p
                  key={`${i}-${line.slice(0, 36)}`}
                  className={
                    isLead
                      ? "font-heading text-3xl font-medium leading-[1.2] text-[var(--forest-sage)] md:text-5xl"
                      : isBeliefClose
                        ? "pt-4 font-heading text-3xl font-medium text-[var(--forest-sage)] md:text-5xl"
                        : isQuestion
                          ? "font-heading text-2xl leading-[1.3] text-[var(--forest-sage)] md:text-4xl"
                          : isHumanLine
                            ? "font-heading text-2xl leading-[1.3] text-[var(--forest-sage)] md:text-3xl"
                            : "font-heading text-xl leading-[1.4] text-[var(--forest-sage)]/75 md:text-2xl"
                  }
                >
                  {line}
                </p>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Hospitality Comes First ── */}
      <section
        id="hospitality"
        className="scroll-mt-28 border-y border-[var(--taupe-light)] bg-[var(--linen)] px-6 py-28 md:py-40"
      >
        <div className="mx-auto max-w-3xl">
          <p className="text-xs tracking-[0.22em] uppercase text-[var(--heritage-sage)]">
            {page.hospitality.eyebrow}
          </p>
          <h2 className="mt-6 font-heading text-3xl font-medium leading-[1.15] text-[var(--forest-sage)] md:text-5xl">
            {page.hospitality.headline}
          </h2>
          <div className="mt-14 space-y-6 md:mt-16">
            {page.hospitality.lines.map((line, i) => (
              <p
                key={line}
                className={
                  i < 3
                    ? "font-heading text-2xl leading-[1.3] text-[var(--forest-sage)] md:text-3xl"
                    : "font-heading text-xl leading-[1.35] text-[var(--forest-sage)]/70 md:text-2xl"
                }
              >
                {line}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* Care before guests — hospitality without words */}
      <div className="px-6 py-16 md:py-20">
        <div className="relative mx-auto aspect-[16/9] w-full max-w-5xl overflow-hidden md:aspect-[2.2/1]">
          <Image
            src={FILM.whyCarePrep}
            alt="Our Promise — built on trust, focused on hospitality"
            fill
            className="object-cover object-center"
            sizes="100vw"
            priority
          />
        </div>
      </div>

      {/* ── Our Promise ── */}
      <section
        id="promise"
        className="scroll-mt-28 px-6 py-28 md:py-40"
      >
        <div className="mx-auto max-w-3xl">
          <p className="text-xs tracking-[0.22em] uppercase text-[var(--heritage-sage)]">
            {page.promise.eyebrow}
          </p>
          <h2 className="mt-6 font-heading text-3xl font-medium leading-[1.15] whitespace-pre-line text-[var(--forest-sage)] md:text-5xl">
            {page.promise.headline}
          </h2>
          <div className="mt-14 space-y-6 md:mt-16">
            {page.promise.lines.map((line) => {
              const isQuestion = line.startsWith("Will ");
              return (
                <p
                  key={line}
                  className={
                    isQuestion
                      ? "font-heading text-2xl leading-[1.3] text-[var(--forest-sage)] md:text-3xl"
                      : "font-heading text-xl leading-[1.4] text-[var(--forest-sage)]/75 md:text-2xl"
                  }
                >
                  {line}
                </p>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Our First Friends + A Place Reserved For You (unchanged) ── */}
      <div id="our-first-friends" className="scroll-mt-28">
        <OurFirstFriends letterOnly />
      </div>

      {/* ── Trust ── */}
      <section
        id="trust"
        className="scroll-mt-28 border-y border-[var(--taupe-medium)]/40 bg-[var(--linen)] px-6 py-28 md:py-36"
      >
        <div className="mx-auto max-w-3xl">
          <p className="text-xs tracking-[0.22em] uppercase text-[var(--heritage-sage)]">
            {page.trust.eyebrow}
          </p>
          <h2 className="mt-6 font-heading text-3xl font-medium text-[var(--forest-sage)] md:text-5xl">
            {page.trust.headline}
          </h2>
          <p className="mt-8 font-heading text-2xl leading-snug text-[var(--forest-sage)]/80 md:text-3xl">
            {page.trust.subhead}
          </p>
          <div className="mt-10 space-y-5 text-base leading-relaxed text-[var(--forest-sage)]/70 md:text-lg">
            {page.trust.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <ul className="mt-14 flex flex-wrap gap-x-8 gap-y-3">
            {page.trust.ideas.map((idea) => (
              <li
                key={idea}
                className="text-sm tracking-[0.12em] uppercase text-[var(--heritage-sage)]"
              >
                {idea}
              </li>
            ))}
          </ul>
          <p className="mt-14">
            <Link
              href={page.trust.cta.href}
              className="font-heading text-xl text-[var(--forest-sage)] underline-offset-8 hover:underline md:text-2xl"
            >
              {page.trust.cta.label}
            </Link>
          </p>
        </div>
      </section>

      {/* ── Pricing Philosophy — short, links out ── */}
      <section
        id="pricing-philosophy"
        className="scroll-mt-28 px-6 py-28 md:py-36"
      >
        <div className="mx-auto max-w-3xl">
          <p className="text-xs tracking-[0.22em] uppercase text-[var(--heritage-sage)]">
            {page.pricingPhilosophy.eyebrow}
          </p>
          <div className="mt-10 space-y-6">
            {page.pricingPhilosophy.lines.map((line) => (
              <p
                key={line}
                className="font-heading text-2xl leading-[1.35] text-[var(--forest-sage)] md:text-3xl"
              >
                {line}
              </p>
            ))}
          </div>
          <p className="mt-14">
            <Link
              href={page.pricingPhilosophy.cta.href}
              className="font-heading text-xl text-[var(--forest-sage)] underline-offset-8 hover:underline md:text-2xl"
            >
              {page.pricingPhilosophy.cta.label}
            </Link>
          </p>
        </div>
      </section>

      {/* ── Welcome Home ── */}
      <section
        id="welcome"
        className="scroll-mt-28 border-t border-[var(--taupe-medium)]/40 px-6 py-28 text-center md:py-40"
      >
        <div className="mx-auto max-w-3xl">
          <p className="text-xs tracking-[0.22em] uppercase text-[var(--heritage-sage)]">
            {page.welcome.eyebrow}
          </p>
          <div className="mt-10 space-y-8">
            {page.welcome.lines.map((line) => (
              <p
                key={line}
                className="font-heading text-2xl leading-[1.3] text-[var(--forest-sage)] md:text-4xl"
              >
                {line}
              </p>
            ))}
          </div>
          <div className="mt-14 md:mt-16">
            <MarketingCta />
          </div>
        </div>
      </section>
    </div>
  );
}
