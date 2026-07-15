import type { LegalDocument } from "@/lib/marketing/legal";

/**
 * Calm editorial renderer for Trust legal drafts.
 */
export function LegalDocumentView({ document }: { document: LegalDocument }) {
  return (
    <article className="bg-[var(--true-white)] px-6 pt-[140px] pb-28 md:pb-36">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs tracking-[0.22em] uppercase text-[var(--heritage-sage)]">
          Legal
        </p>
        <h1 className="mt-5 font-heading text-4xl font-medium text-[var(--forest-sage)] md:text-6xl">
          {document.title}
        </h1>
        <p className="mt-4 text-sm text-[var(--forest-sage)]/55">
          Effective date: {document.effectiveDate}
        </p>
        <p className="mt-8 text-base leading-relaxed text-[var(--forest-sage)]/70 md:text-lg">
          {document.notice}
        </p>
        <p className="mt-6 text-sm italic text-[var(--forest-sage)]/50">
          Draft for counsel review before launch.
        </p>

        <div className="mt-16 space-y-14">
          {document.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="font-heading text-2xl text-[var(--forest-sage)] md:text-3xl">
                {section.heading}
              </h2>
              {section.paragraphs?.map((paragraph) => (
                <p
                  key={paragraph.slice(0, 48)}
                  className="mt-5 text-base leading-relaxed text-[var(--forest-sage)]/75 md:text-lg"
                >
                  {paragraph}
                </p>
              ))}
              {section.bullets ? (
                <ul className="mt-5 space-y-3">
                  {section.bullets.map((bullet) => (
                    <li
                      key={bullet}
                      className="flex items-start gap-3 text-base leading-relaxed text-[var(--forest-sage)]/75 md:text-lg"
                    >
                      <span
                        className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-[var(--heritage-sage)]"
                        aria-hidden
                      />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}
