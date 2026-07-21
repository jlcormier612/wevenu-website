import Image from "next/image";
import Link from "next/link";

import { TrustRule } from "@/components/marketing/brand-accents";
import { TrustSecurityPoints } from "@/components/marketing/trust-security-points";
import { FILM } from "@/lib/marketing/film";
import { EDITORIAL_FRAME, EDITORIAL_IMAGE, HOVER_NAV } from "@/lib/marketing/rhythm";
import { TRUST_PAGE } from "@/lib/marketing/trust-page";

/** Trust H2s — ~12% larger than prior 2.1 / 3.36 */
const TRUST_H2 =
  "mt-7 font-heading text-[2.35rem] whitespace-pre-line text-[var(--forest-sage)] md:text-[3.76rem]";
/** Uppercase labels — ~10% quieter than /82 */
const TRUST_LABEL =
  "text-[0.7125rem] tracking-[0.22em] uppercase text-[var(--heritage-sage)]/74";

/**
 * Trust experience — editorial publication for security, privacy, reliability, and transparency.
 */
export function TrustExperience() {
  const page = TRUST_PAGE;

  return (
    <div className="bg-[var(--true-white)]">
      {/* ── Hero — Our Promise (unchanged) ── */}
      <section className="px-6 pt-[140px] pb-28 md:pb-36">
        <div className="mx-auto max-w-[65ch]">
          <TrustRule className="mb-5" />
          <p className="text-[0.7125rem] tracking-[0.22em] uppercase text-[var(--heritage-sage)]/82">
            {page.hero.title}
          </p>
          <p className="mt-8 font-heading text-2xl leading-snug text-[var(--forest-sage)]/80 md:text-3xl">
            {page.hero.chapterTitle}
          </p>
          <h1 className="mt-8 font-heading text-[2.52rem] font-medium leading-[1.16] tracking-tight text-[var(--forest-sage)] md:text-[4.2rem]">
            {page.hero.headline}
          </h1>
          <p className="mt-8 font-heading text-2xl leading-snug text-[var(--forest-sage)]/80 md:text-3xl">
            {page.hero.subhead}
          </p>
          <div className="mt-8 space-y-4 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg max-w-[65ch]">
            {page.hero.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>

        <div className={`relative mx-auto mt-14 aspect-[16/9] w-full max-w-5xl md:mt-16 md:aspect-[2.2/1] ${EDITORIAL_FRAME}`}>
          <Image
            src={FILM.trustEarned}
            alt="Trust — earned every month, kept for every celebration"
            fill
            className={EDITORIAL_IMAGE}
            sizes="100vw"
            priority
          />
        </div>
      </section>

      {/* ── In-page nav ── */}
      <nav
        className="border-y border-[var(--taupe-medium)]/40 bg-[var(--linen)] px-6 py-8"
        aria-label="Trust topics"
      >
        <ul className="mx-auto flex max-w-5xl flex-wrap gap-x-6 gap-y-3">
          {page.nav.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className={`text-sm tracking-wide text-[var(--forest-sage)]/65 transition duration-200 ease-out ${HOVER_NAV}`}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* ── Security ── */}
      <section id="security" className="scroll-mt-28 px-6 py-28 md:py-36">
        <div className="mx-auto max-w-3xl">
          <TrustRule className="mb-5" />
          <p className={TRUST_LABEL}>{page.security.title}</p>
          <h2 className={TRUST_H2}>{page.security.headline}</h2>
          <div className="mt-8 max-w-[65ch] space-y-4 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg">
            {page.security.intro.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <TrustSecurityPoints points={page.security.points} />
        </div>
      </section>

      {/* ── Privacy ── */}
      <section
        id="privacy"
        className="scroll-mt-28 border-y border-[var(--taupe-medium)]/40 bg-[var(--linen)] px-6 py-28 md:py-36"
      >
        <div className="mx-auto max-w-3xl">
          <TrustRule className="mb-5" />
          <p className={TRUST_LABEL}>{page.privacy.title}</p>
          <h2 className={TRUST_H2}>{page.privacy.headline}</h2>
          <div className="mt-8 space-y-5">
            {page.privacy.lines.map((line) => (
              <p
                key={line}
                className="font-heading text-2xl leading-snug text-[var(--forest-sage)] md:text-3xl"
              >
                {line}
              </p>
            ))}
          </div>
          <p className="mt-12">
            <Link
              href={page.privacy.cta.href}
              className="font-heading text-xl text-[var(--forest-sage)] underline-offset-8 hover:underline md:text-2xl"
            >
              {page.privacy.cta.label}
            </Link>
          </p>
        </div>
      </section>

      {/* ── Data Ownership ── */}
      <section id="data-ownership" className="scroll-mt-28 px-6 py-28 md:py-36">
        <div className="mx-auto max-w-3xl">
          <TrustRule className="mb-5" />
          <p className={TRUST_LABEL}>{page.dataOwnership.title}</p>
          <h2 className={TRUST_H2}>{page.dataOwnership.headline}</h2>
          <p className="mt-6 font-heading text-2xl text-[var(--forest-sage)]/80 md:text-3xl">
            {page.dataOwnership.subhead}
          </p>
          <div className="mt-8 space-y-5 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg max-w-[65ch]">
            {page.dataOwnership.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
      </section>

      {/* ── Reliability ── */}
      <section
        id="reliability"
        className="scroll-mt-28 border-y border-[var(--taupe-medium)]/40 bg-[var(--linen)] px-6 py-28 md:py-36"
      >
        <div className="mx-auto max-w-3xl">
          <TrustRule className="mb-5" />
          <p className={TRUST_LABEL}>{page.reliability.title}</p>
          <h2 className={TRUST_H2}>{page.reliability.headline}</h2>
          <div className="mt-14 space-y-10">
            {page.reliability.points.map((point) => (
              <div key={point.title}>
                <h3 className="font-heading text-xl text-[var(--forest-sage)] md:text-2xl">
                  {point.title}
                </h3>
                <p className="mt-3 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg max-w-[65ch]">
                  {point.body}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-12 text-sm leading-[1.7] text-[var(--forest-sage)]/55">
            {page.reliability.disclaimer}
          </p>
          <p className="mt-8">
            <Link
              href={page.reliability.statusCta.href}
              className="font-heading text-xl text-[var(--forest-sage)] underline-offset-8 hover:underline md:text-2xl"
            >
              {page.reliability.statusCta.label}
            </Link>
          </p>
        </div>
      </section>

      {/* ── Compliance ── */}
      <section id="compliance" className="scroll-mt-28 px-6 py-28 md:py-36">
        <div className="mx-auto max-w-3xl">
          <TrustRule className="mb-5" />
          <p className={TRUST_LABEL}>{page.compliance.title}</p>
          <h2 className={TRUST_H2}>{page.compliance.headline}</h2>
          <div className="mt-8 space-y-5 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg max-w-[65ch]">
            {page.compliance.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
      </section>

      {/* ── Terms ── */}
      <section
        id="terms"
        className="scroll-mt-28 border-y border-[var(--taupe-medium)]/40 bg-[var(--linen)] px-6 py-28 md:py-36"
      >
        <div className="mx-auto max-w-3xl">
          <TrustRule className="mb-5" />
          <p className={TRUST_LABEL}>{page.terms.title}</p>
          <h2 className={TRUST_H2}>{page.terms.headline}</h2>
          <div className="mt-8 space-y-5 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg max-w-[65ch]">
            {page.terms.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <p className="mt-12">
            <Link
              href={page.terms.cta.href}
              className="font-heading text-xl text-[var(--forest-sage)] underline-offset-8 hover:underline md:text-2xl"
            >
              {page.terms.cta.label}
            </Link>
          </p>
        </div>
      </section>

      {/* ── Subscription Philosophy ── */}
      <section id="subscription" className="scroll-mt-28 px-6 py-28 md:py-36">
        <div className="mx-auto max-w-3xl">
          <TrustRule className="mb-5" />
          <p className={TRUST_LABEL}>{page.subscription.title}</p>
          <h2 className={TRUST_H2}>{page.subscription.headline}</h2>
          <div className="mt-8 space-y-5 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg max-w-[65ch]">
            {page.subscription.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
      </section>

      {/* ── Cancel Anytime ── */}
      <section
        id="cancellation"
        className="scroll-mt-28 border-y border-[var(--taupe-medium)]/40 bg-[var(--linen)] px-6 py-28 md:py-36"
      >
        <div className="mx-auto max-w-3xl">
          <TrustRule className="mb-5" />
          <h2 className="font-heading text-[2.35rem] text-[var(--forest-sage)] md:text-[3.76rem]">
            {page.cancellation.title}
          </h2>
          <div className="mt-8 space-y-5 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg max-w-[65ch]">
            {page.cancellation.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
      </section>

      {/* ── Happiness Promise ── */}
      <section id="happiness" className="scroll-mt-28 px-6 py-28 md:py-36">
        <div className="mx-auto max-w-3xl">
          <TrustRule className="mb-5" />
          <h2 className="font-heading text-[2.35rem] text-[var(--forest-sage)] md:text-[3.76rem]">
            {page.happiness.title}
          </h2>
          <div className="mt-8 space-y-5 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg max-w-[65ch]">
            {page.happiness.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
      </section>

      {/* ── Built for the long haul + signature ── */}
      <section className="border-t border-[var(--taupe-medium)]/40 px-6 py-28 md:py-36">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-heading text-[2.35rem] text-[var(--forest-sage)] md:text-[3.76rem]">
            {page.close.headline}
          </h2>
          <div className="mx-auto mt-8 max-w-[65ch] space-y-5 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg">
            {page.close.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <div className="mt-20 md:mt-24">
            <p className="font-heading text-xl text-[var(--forest-sage)] md:text-2xl">
              {page.close.signature.brand}
            </p>
            <p className="mt-3 text-sm tracking-wide text-[var(--forest-sage)]/55 md:text-base">
              {page.close.signature.line}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
