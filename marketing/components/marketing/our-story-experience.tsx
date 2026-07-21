import Image from "next/image";
import Link from "next/link";

import { ClosingCta } from "@/components/marketing/closing-cta";
import { HospitalityHeart, TrustRule } from "@/components/marketing/brand-accents";
import { OurFirstFriends } from "@/components/marketing/our-first-friends";
import { FILM } from "@/lib/marketing/film";
import { EDITORIAL_BREAK_Y, EDITORIAL_FRAME, EDITORIAL_IMAGE } from "@/lib/marketing/rhythm";
import { OUR_STORY } from "@/lib/marketing/our-story";

/**
 * Our Story — editorial belief chapter.
 * Unique purpose: why this company exists. Never repeats Home.
 */
export function OurStoryExperience() {
  const page = OUR_STORY;

  return (
    <div className="bg-[var(--true-white)]">
      {/* ── Opening — belief, not Home ── */}
      <section className="px-6 pt-[140px] pb-28 md:pb-36">
        <div className="mx-auto max-w-[65ch]">
          <p className="text-[0.7125rem] tracking-[0.22em] uppercase text-[var(--heritage-sage)]/82">
            {page.opening.eyebrow}
          </p>
          <h1 className="mt-8 font-heading text-[2.52rem] font-medium leading-[1.21] tracking-tight text-[var(--forest-sage)] md:text-[4.2rem]">
            {page.opening.chapterTitle}
          </h1>
          <div className="mt-8 space-y-5 md:space-y-6">
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
                      ? "font-heading text-[2.1rem] font-medium leading-[1.26] text-[var(--forest-sage)] md:text-[3.36rem]"
                      : isBeliefClose
                        ? "pt-4 font-heading text-[2.1rem] font-medium text-[var(--forest-sage)] md:text-[3.36rem]"
                        : isQuestion
                          ? "font-heading text-[1.4rem] leading-[1.37] text-[var(--forest-sage)] md:text-[2.52rem]"
                          : isHumanLine
                            ? "font-heading text-[1.4rem] leading-[1.37] text-[var(--forest-sage)] md:text-[2.1rem]"
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
        className="scroll-mt-28 border-y border-[var(--taupe-light)] bg-[var(--linen)] px-6 py-28 md:py-36"
      >
        <div className="mx-auto max-w-6xl">
          <HospitalityHeart size={14} className="mb-5 opacity-[0.8]" />
          <p className="text-[0.7125rem] tracking-[0.22em] uppercase text-[var(--heritage-sage)]/82">
            {page.hospitality.eyebrow}
          </p>
          <h2 className="mt-7 max-w-3xl font-heading text-[2.1rem] font-medium leading-[1.21] text-[var(--forest-sage)] md:text-[3.36rem]">
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
      <div className={`px-6 ${EDITORIAL_BREAK_Y}`}>
        <div className={`relative mx-auto aspect-[16/9] w-full max-w-5xl md:aspect-[2.2/1] ${EDITORIAL_FRAME}`}>
          <Image
            src={FILM.whyCarePrep}
            alt="Our Promise — built on trust, focused on hospitality"
            fill
            className={EDITORIAL_IMAGE}
            sizes="100vw"
            priority
          />
        </div>
      </div>

      {/* ── Our Promise ── */}
      <section
        id="promise"
        className="scroll-mt-28 px-6 py-28 md:py-36"
      >
        <div className="mx-auto max-w-6xl">
          <p className="text-[0.7125rem] tracking-[0.22em] uppercase text-[var(--heritage-sage)]/82">
            {page.promise.eyebrow}
          </p>
          <h2 className="mt-7 max-w-3xl font-heading text-[2.1rem] font-medium leading-[1.21] whitespace-pre-line text-[var(--forest-sage)] md:text-[3.36rem]">
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

      {/* ── The Role of Luv ── */}
      <section
        id="role-of-luv"
        className="scroll-mt-28 border-y border-[var(--taupe-light)] bg-[var(--linen)] px-6 py-28 md:py-36"
      >
        <div className="mx-auto max-w-6xl">
          <p className="text-[0.7125rem] tracking-[0.22em] uppercase text-[var(--heritage-sage)]/82">
            {page.roleOfLuv.eyebrow}
          </p>
          <h2 className="mt-7 max-w-3xl font-heading text-[2.1rem] font-medium leading-[1.21] text-[var(--forest-sage)] md:text-[3.36rem]">
            {page.roleOfLuv.headline}
          </h2>
          <div className="mt-14 space-y-6 md:mt-16">
            {page.roleOfLuv.lines.map((line, i) => (
              <p
                key={line}
                className={
                  i === 1
                    ? "font-heading text-xl leading-[1.35] text-[var(--forest-sage)]/70 md:text-2xl"
                    : "font-heading text-2xl leading-[1.3] text-[var(--forest-sage)] md:text-3xl"
                }
              >
                {line}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* ── Our First Friends ── */}
      <div id="our-first-friends" className="scroll-mt-28">
        <OurFirstFriends letterOnly />
      </div>

      {/* ── Trust ── */}
      <section
        id="trust"
        className="scroll-mt-28 border-y border-[var(--taupe-medium)]/40 bg-[var(--linen)] px-6 py-28 md:py-36"
      >
        <div className="mx-auto max-w-3xl">
          <TrustRule className="mb-5" />
          <p className="text-[0.7125rem] tracking-[0.22em] uppercase text-[var(--heritage-sage)]/82">
            {page.trust.eyebrow}
          </p>
          <h2 className="mt-7 font-heading text-[2.1rem] font-medium text-[var(--forest-sage)] md:text-[3.36rem]">
            {page.trust.headline}
          </h2>
          <p className="mt-6 font-heading text-2xl leading-snug text-[var(--forest-sage)]/80 md:text-3xl">
            {page.trust.subhead}
          </p>
          <div className="mt-8 space-y-5 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg max-w-[65ch]">
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
          <p className="text-[0.7125rem] tracking-[0.22em] uppercase text-[var(--heritage-sage)]/82">
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

      {/* ── An Invitation ── */}
      <section
        id="welcome"
        className="scroll-mt-28 border-t border-[var(--taupe-medium)]/40 px-6 py-28 text-center md:py-36"
      >
        <div className="mx-auto max-w-5xl">
          <p className="text-[0.7125rem] tracking-[0.22em] uppercase text-[var(--heritage-sage)]/82">
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
          <div className="mt-14 flex justify-center md:mt-16">
            <ClosingCta />
          </div>
        </div>
      </section>
    </div>
  );
}
