import { MarketingCta } from "@/components/marketing/marketing-cta";
import { FEATURES_PAGE } from "@/lib/marketing/features-page";

/**
 * Features catalog — calm, scannable, confidence-inspiring.
 * Answers: Does Wevenu have everything I need to run my venue?
 */
export function FeaturesExperience() {
  const page = FEATURES_PAGE;

  return (
    <div className="bg-[var(--true-white)]">
      {/* ── Hero ── */}
      <section className="px-6 pt-[140px] pb-24 md:pb-32">
        <div className="mx-auto max-w-[700px]">
          <h1 className="font-heading text-4xl font-medium leading-[1.1] text-[var(--forest-sage)] md:text-6xl">
            {page.hero.headline}
          </h1>
          <div className="mt-8 space-y-4 text-base leading-relaxed text-[var(--forest-sage)]/70 md:text-lg">
            {page.hero.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
      </section>

      {/* ── Catalog chapters ── */}
      {page.sections.map((section) => (
        <section
          key={section.id}
          id={section.id}
          className="scroll-mt-28 border-t border-[var(--taupe-medium)]/40 px-6 py-20 md:py-28"
        >
          <div className="mx-auto max-w-6xl">
            <h2 className="font-heading text-3xl text-[var(--forest-sage)] md:text-4xl">
              {section.title}
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--forest-sage)]/65 md:text-lg">
              {section.intro}
            </p>
            <ul className="mt-12 grid gap-x-10 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              {section.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-baseline gap-3 text-base text-[var(--forest-sage)]/85 md:text-lg"
                >
                  <span
                    className="shrink-0 font-heading text-lg leading-none text-[var(--heritage-sage)]"
                    aria-hidden
                  >
                    ✓
                  </span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}

      {/* ── Close ── */}
      <section className="border-t border-[var(--taupe-medium)]/40 bg-[var(--linen)] px-6 py-28 md:py-36">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl text-[var(--forest-sage)] md:text-5xl">
            {page.close.headline}
          </h2>
          <div className="mt-8 space-y-3 text-base leading-relaxed text-[var(--forest-sage)]/70 md:text-lg">
            {page.close.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <div className="mt-12 flex justify-center">
            <MarketingCta />
          </div>
        </div>
      </section>
    </div>
  );
}
