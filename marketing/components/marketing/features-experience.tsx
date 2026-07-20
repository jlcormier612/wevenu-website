import { ClosingCta } from "@/components/marketing/closing-cta";
import { FEATURES_PAGE } from "@/lib/marketing/features-page";
import { SECTION_SCROLL } from "@/lib/marketing/rhythm";

/**
 * Features catalog — calm, scannable, confidence-inspiring.
 * Answers: Does Hello to Cheers have everything I need to run my venue?
 */
export function FeaturesExperience() {
  const page = FEATURES_PAGE;

  return (
    <div className="bg-[var(--true-white)]">
      {/* ── Hero ── */}
      <section className="px-6 pt-[140px] pb-28 md:pb-36">
        <div className="mx-auto max-w-[65ch]">
          <p className="text-[0.7125rem] tracking-[0.22em] uppercase text-[var(--heritage-sage)]/82">
            {page.hero.eyebrow}
          </p>
          <h1 className="mt-8 font-heading text-[2.52rem] font-medium leading-[1.16] tracking-tight text-[var(--forest-sage)] md:text-[4.2rem]">
            {page.hero.chapterTitle}
          </h1>
          <p className="mt-8 font-heading text-2xl leading-snug text-[var(--forest-sage)]/80 md:text-3xl">
            {page.hero.headline}
          </p>
          <div className="mt-8 max-w-[65ch] space-y-4 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg">
            {page.hero.lines.map((line) => (
              <p key={line}>
                {line}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* ── Catalog chapters ── */}
      {page.sections.map((section) => {
        return (
          <section
            key={section.id}
            id={section.id}
            className={`${SECTION_SCROLL} border-t border-[var(--taupe-medium)]/40`}
          >
            <div className="mx-auto max-w-6xl">
              <h2 className="font-heading text-[2.1rem] text-[var(--forest-sage)] md:text-[2.52rem]">
                {section.title}
              </h2>
              <p className="mt-4 max-w-[540px] text-base leading-[1.7] text-[var(--forest-sage)]/65 md:text-lg">
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
        );
      })}

      {/* ── Close ── */}
      <section className="border-t border-[var(--taupe-medium)]/40 bg-[var(--linen)] px-6 py-28 md:py-36">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-[2.1rem] text-[var(--forest-sage)] md:text-[3.36rem]">
            {page.close.headline}
          </h2>
          <div className="mt-8 space-y-3 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg max-w-[65ch]">
            {page.close.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <div className="mt-12 flex justify-center">
            <ClosingCta />
          </div>
        </div>
      </section>
    </div>
  );
}
