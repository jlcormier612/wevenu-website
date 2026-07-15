import Image from "next/image";
import Link from "next/link";

import { FILM } from "@/lib/marketing/film";
import { TRUST_PAGE } from "@/lib/marketing/trust-page";

/**
 * Trust experience — editorial publication for security, privacy, reliability, and transparency.
 */
export function TrustExperience() {
  const page = TRUST_PAGE;

  return (
    <div className="bg-[var(--true-white)]">
      {/* ── Hero ── */}
      <section className="px-6 pt-[140px] pb-20 md:pb-28">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs tracking-[0.22em] uppercase text-[var(--heritage-sage)]">
            {page.hero.title}
          </p>
          <h1 className="mt-6 font-heading text-4xl font-medium leading-[1.1] text-[var(--forest-sage)] md:text-6xl">
            {page.hero.headline}
          </h1>
          <p className="mt-8 font-heading text-2xl leading-snug text-[var(--forest-sage)]/80 md:text-3xl">
            {page.hero.subhead}
          </p>
          <div className="mt-10 space-y-4 text-base leading-relaxed text-[var(--forest-sage)]/70 md:text-lg">
            {page.hero.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>

        <div className="relative mx-auto mt-16 aspect-[16/9] w-full max-w-5xl overflow-hidden md:mt-20 md:aspect-[2.2/1]">
          <Image
            src={FILM.emptyChairs}
            alt="Quiet hospitality space ready for guests — calm, intentional, trustworthy"
            fill
            className="object-cover object-[center_40%]"
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
                className="text-sm tracking-wide text-[var(--forest-sage)]/65 transition hover:text-[var(--forest-sage)]"
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
          <p className="text-xs tracking-[0.22em] uppercase text-[var(--heritage-sage)]">
            {page.security.title}
          </p>
          <h2 className="mt-5 font-heading text-3xl text-[var(--forest-sage)] md:text-5xl">
            {page.security.headline}
          </h2>
          <div className="mt-8 space-y-4 text-base leading-relaxed text-[var(--forest-sage)]/70 md:text-lg">
            {page.security.intro.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <div className="mt-16 space-y-10">
            {page.security.points.map((point) => (
              <div key={point.title}>
                <h3 className="font-heading text-xl text-[var(--forest-sage)] md:text-2xl">
                  {point.title}
                </h3>
                <p className="mt-3 text-base leading-relaxed text-[var(--forest-sage)]/70 md:text-lg">
                  {point.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Privacy ── */}
      <section
        id="privacy"
        className="scroll-mt-28 border-y border-[var(--taupe-medium)]/40 bg-[var(--linen)] px-6 py-28 md:py-36"
      >
        <div className="mx-auto max-w-3xl">
          <p className="text-xs tracking-[0.22em] uppercase text-[var(--heritage-sage)]">
            {page.privacy.title}
          </p>
          <h2 className="mt-5 font-heading text-3xl text-[var(--forest-sage)] md:text-5xl">
            {page.privacy.headline}
          </h2>
          <div className="mt-10 space-y-5">
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
          <p className="text-xs tracking-[0.22em] uppercase text-[var(--heritage-sage)]">
            {page.dataOwnership.title}
          </p>
          <h2 className="mt-5 font-heading text-3xl text-[var(--forest-sage)] md:text-5xl">
            {page.dataOwnership.headline}
          </h2>
          <p className="mt-6 font-heading text-2xl text-[var(--forest-sage)]/80 md:text-3xl">
            {page.dataOwnership.subhead}
          </p>
          <div className="mt-10 space-y-5 text-base leading-relaxed text-[var(--forest-sage)]/70 md:text-lg">
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
          <p className="text-xs tracking-[0.22em] uppercase text-[var(--heritage-sage)]">
            {page.reliability.title}
          </p>
          <h2 className="mt-5 font-heading text-3xl text-[var(--forest-sage)] md:text-5xl">
            {page.reliability.headline}
          </h2>
          <div className="mt-14 space-y-10">
            {page.reliability.points.map((point) => (
              <div key={point.title}>
                <h3 className="font-heading text-xl text-[var(--forest-sage)] md:text-2xl">
                  {point.title}
                </h3>
                <p className="mt-3 text-base leading-relaxed text-[var(--forest-sage)]/70 md:text-lg">
                  {point.body}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-12 text-sm leading-relaxed text-[var(--forest-sage)]/55">
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
          <p className="text-xs tracking-[0.22em] uppercase text-[var(--heritage-sage)]">
            {page.compliance.title}
          </p>
          <h2 className="mt-5 font-heading text-3xl text-[var(--forest-sage)] md:text-5xl">
            {page.compliance.headline}
          </h2>
          <div className="mt-10 space-y-5 text-base leading-relaxed text-[var(--forest-sage)]/70 md:text-lg">
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
          <p className="text-xs tracking-[0.22em] uppercase text-[var(--heritage-sage)]">
            {page.terms.title}
          </p>
          <h2 className="mt-5 font-heading text-3xl text-[var(--forest-sage)] md:text-5xl">
            {page.terms.headline}
          </h2>
          <div className="mt-10 space-y-5 text-base leading-relaxed text-[var(--forest-sage)]/75 md:text-lg">
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
          <p className="text-xs tracking-[0.22em] uppercase text-[var(--heritage-sage)]">
            {page.subscription.title}
          </p>
          <h2 className="mt-5 font-heading text-3xl text-[var(--forest-sage)] md:text-5xl">
            {page.subscription.headline}
          </h2>
          <div className="mt-10 space-y-5 text-base leading-relaxed text-[var(--forest-sage)]/75 md:text-lg">
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
          <h2 className="font-heading text-3xl text-[var(--forest-sage)] md:text-5xl">
            {page.cancellation.title}
          </h2>
          <div className="mt-10 space-y-5 text-base leading-relaxed text-[var(--forest-sage)]/75 md:text-lg">
            {page.cancellation.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
      </section>

      {/* ── Happiness Promise ── */}
      <section id="happiness" className="scroll-mt-28 px-6 py-28 md:py-36">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-heading text-3xl text-[var(--forest-sage)] md:text-5xl">
            {page.happiness.title}
          </h2>
          <div className="mt-10 space-y-5 text-base leading-relaxed text-[var(--forest-sage)]/75 md:text-lg">
            {page.happiness.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
      </section>

      {/* ── Close ── */}
      <section className="border-t border-[var(--taupe-medium)]/40 px-6 py-28 md:py-36">
        <div className="mx-auto max-w-3xl text-center">
          {page.close.lines.map((line) => (
            <p
              key={line}
              className="font-heading text-2xl italic leading-snug text-[var(--forest-sage)] md:text-4xl"
            >
              {line}
            </p>
          ))}
        </div>
      </section>
    </div>
  );
}
