import Image from "next/image";
import Link from "next/link";

import { MarketingCta } from "@/components/marketing/marketing-cta";
import { UiPlaceholder } from "@/components/marketing/ui-placeholder";
import { FILM } from "@/lib/marketing/film";
import { PRODUCT_JOURNEY, PRODUCT_PAGE } from "@/lib/marketing/product-page";
import { cn } from "@/lib/utils";

/**
 * Product experience page — editorial, one message per section.
 * No feature cards, icon grids, or SaaS inventories.
 */
export function ProductExperience() {
  const p = PRODUCT_PAGE;

  return (
    <div className="bg-[var(--true-white)]">
      {/* ── Section 1 · Product Hero ── */}
      <section className="bg-[var(--true-white)] px-6 pt-[140px] pb-[120px]">
        <div className="mx-auto max-w-[700px]">
          <p
            className="text-xs tracking-[0.18em] uppercase text-[var(--heritage-sage)]"
            style={{ letterSpacing: "0.18em" }}
          >
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
              href="#connected-journey"
              label={p.hero.secondaryCta}
              variant="secondary"
            />
          </div>
        </div>
      </section>

      {/* ── Section 2 · The Philosophy ── */}
      <section className="flex min-h-[520px] items-center bg-[var(--true-white)] px-6 py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-heading text-4xl font-medium leading-[1.1] text-[var(--forest-sage)] md:text-5xl lg:text-6xl">
            {p.philosophy.headline}
          </h2>
          <div className="mx-auto mt-10 max-w-xl space-y-5 text-base leading-relaxed text-[var(--forest-sage)]/70 md:text-lg">
            {p.philosophy.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 3 · The Connected Journey ── */}
      <section id="connected-journey" className="scroll-mt-28 bg-[var(--true-white)] px-6 py-24 md:py-32">
        <div className="mx-auto grid max-w-6xl items-stretch gap-12 md:grid-cols-2 md:gap-0">
          <div className="relative min-h-[420px] overflow-hidden md:min-h-[640px]">
            <Image
              src={FILM.emptyChairs}
              alt="Elegant reception under soft string lights before guests arrive"
              fill
              className="object-cover"
              sizes="50vw"
              priority={false}
            />
          </div>
          <div className="flex flex-col justify-center md:pl-16 lg:pl-20">
            <p className="text-xs tracking-[0.22em] uppercase text-[var(--heritage-sage)]">
              {p.journey.eyebrow}
            </p>
            <h2 className="mt-4 max-w-md font-heading text-3xl text-[var(--forest-sage)] md:text-4xl">
              {p.journey.headline}
            </h2>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-[var(--forest-sage)]/65">
              {p.journey.support}
            </p>
            <nav className="mt-10" aria-label="Connected booking journey">
              <ul>
                {PRODUCT_JOURNEY.map((step, i) => (
                  <li key={step.id}>
                    <Link
                      href={`/product/journey/${step.id}`}
                      className={cn(
                        "group flex items-baseline gap-5 border-t border-[var(--taupe-medium)]/70 py-4 transition-colors duration-300",
                        "hover:border-[var(--heritage-sage)]/50",
                        i === PRODUCT_JOURNEY.length - 1 && "border-b",
                      )}
                    >
                      <span className="w-8 shrink-0 font-heading text-lg text-[var(--heritage-sage)]/55 transition-colors group-hover:text-[var(--heritage-sage)] md:text-xl">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="font-heading text-xl text-[var(--forest-sage)] transition-opacity group-hover:opacity-70 md:text-2xl">
                        {step.title}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </section>

      {/* ── Section 4 · The Connected Record ── */}
      <section className="bg-[var(--warm-gray)] px-6 py-28 md:py-36">
        <div className="mx-auto max-w-3xl">
          <p className="marketing-fade-up text-xs tracking-[0.22em] uppercase text-[var(--heritage-sage)]">
            {p.connected.eyebrow}
          </p>
          <h2 className="marketing-fade-up-delay mt-5 font-heading text-3xl text-[var(--forest-sage)] md:text-5xl">
            {p.connected.headline}
          </h2>
          <ul className="mt-14">
            {p.connected.continuum.map((line, i) => (
              <li
                key={line}
                className={cn(
                  "border-t border-[var(--taupe-medium)]/60 py-5 font-heading text-xl text-[var(--forest-sage)]/90 md:text-2xl",
                  i === 0 && "marketing-fade-up-delay-2",
                )}
              >
                {line}
              </li>
            ))}
          </ul>
          <div className="mt-14 space-y-2 border-t border-[var(--taupe-medium)]/60 pt-10 text-sm tracking-wide text-[var(--forest-sage)]/55">
            {p.connected.footer.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 5 · The Workspace ── */}
      <section className="bg-[var(--true-white)] px-6 py-24 md:py-32">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs tracking-[0.22em] uppercase text-[var(--heritage-sage)]">
            {p.workspace.eyebrow}
          </p>
          <h2 className="mt-4 max-w-2xl font-heading text-3xl whitespace-pre-line text-[var(--forest-sage)] md:text-5xl">
            {p.workspace.headline}
          </h2>
          <div className="mt-8 max-w-lg space-y-3 text-base leading-relaxed text-[var(--forest-sage)]/70">
            <p>{p.workspace.intro}</p>
            {p.workspace.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
            <p className="pt-2">{p.workspace.close}</p>
          </div>
          <div className="mt-14">
            <UiPlaceholder
              moment="The workspace"
              capture="Full product screenshot — morning priorities, bookings, planning, conversations, financials, and tasks in one calm frame. Do not crop heavily."
              aspect="wide"
              className="min-h-[360px] md:min-h-[520px]"
            />
          </div>
        </div>
      </section>

      {/* ── Section 6 · Meet Luv ── */}
      <section className="bg-[var(--true-white)] px-6 py-[120px]">
        <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2 md:gap-16">
          <div className="flex flex-col justify-center">
            <p className="text-xs tracking-[0.28em] uppercase text-[var(--heritage-sage)]">
              {p.luv.eyebrow}
            </p>
            <h2 className="mt-4 font-heading text-3xl text-[var(--forest-sage)] md:text-5xl">
              {p.luv.headline}
            </h2>
            <div className="mt-6 space-y-4 text-base leading-relaxed text-[var(--forest-sage)]/75">
              <p>{p.luv.body}</p>
              {p.luv.lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </div>
          <UiPlaceholder
            moment="Luv in the workspace"
            capture="Screenshot with morning briefing, Venue Health, recommendations, activation, and Luv notices visible."
            aspect="tall"
          />
        </div>
      </section>

      {/* ── Section 7 · The Differentiator ── */}
      <section className="bg-[var(--heritage-sage)] px-6 py-28 text-[var(--true-white)] md:py-36">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs tracking-[0.28em] uppercase text-white/45">
            {p.differentiator.eyebrow}
          </p>
          <h2 className="mt-5 max-w-xl font-heading text-4xl font-medium whitespace-pre-line md:text-6xl">
            {p.differentiator.headline}
          </h2>
          <p className="mt-8 max-w-lg whitespace-pre-line text-base leading-relaxed text-white/75 md:text-lg">
            {p.differentiator.support}
          </p>
          <div className="mt-20 grid gap-12 md:grid-cols-3 md:gap-10">
            {p.differentiator.parties.map((party) => (
              <div key={party.name} className="border-t border-white/25 pt-6">
                <h3 className="font-heading text-2xl text-white md:text-3xl">{party.name}</h3>
                <p className="mt-4 text-sm leading-relaxed text-white/65 md:text-base">
                  {party.line}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 8 · Final CTA ── */}
      <section className="bg-[var(--true-white)] px-6 py-32 md:py-40">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="font-heading text-4xl text-[var(--forest-sage)] md:text-5xl">
            {p.cta.headline}
          </h2>
          <div className="mt-8 space-y-2 text-base text-[var(--forest-sage)]/65">
            {p.cta.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <div className="mt-12 flex justify-center">
            <MarketingCta label={p.cta.button} />
          </div>
        </div>
      </section>
    </div>
  );
}
