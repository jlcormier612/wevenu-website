import type { Metadata } from "next";
import Link from "next/link";

import { ConceptSwitcher } from "@/components/marketing/concept-switcher";
import { CONCEPTS } from "@/lib/marketing/vision";

export const metadata: Metadata = {
  title: "Homepage Concepts",
};

export default function ConceptsIndexPage() {
  return (
    <>
      <ConceptSwitcher />
      <section className="mx-auto max-w-4xl px-6 py-28 md:py-36">
        <p className="text-xs tracking-[0.28em] uppercase text-[var(--heritage-sage)]">
          Creative exploration
        </p>
        <h1 className="mt-4 font-heading text-[2.52rem] font-medium text-[var(--forest-sage)] md:text-[3.36rem]">
          Three homepage concepts. Same vision. Radically different compositions.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-[1.7] text-[var(--forest-sage)]/70">
          Each honors the hospitality-magazine direction: feel understood, prove that
          everything is connected, never build a SaaS feature dump. Compare them,
          then we borrow the strongest pieces into a single homepage.
        </p>

        <ol className="mt-16 space-y-8">
          {CONCEPTS.map((c) => (
            <li key={c.id} className="border-t border-[var(--taupe-light)] pt-8">
              <Link href={`/concepts/${c.slug}`} className="group block">
                <p className="text-[0.7125rem] tracking-[0.22em] uppercase text-[var(--heritage-sage)]/82">
                  {c.name}
                </p>
                <h2 className={`mt-2 font-heading text-[2.1rem] text-[var(--forest-sage)] transition-opacity duration-200 ease-out group-hover:opacity-[0.96]`}>
                  {c.label}
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-[1.7] text-[var(--forest-sage)]/65">
                  {c.thesis}
                </p>
                <p className="mt-4 text-sm text-[var(--heritage-sage)] underline-offset-4 group-hover:underline">
                  Open concept →
                </p>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
