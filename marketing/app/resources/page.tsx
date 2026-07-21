import type { Metadata } from "next";
import Link from "next/link";

import { TrustRule } from "@/components/marketing/brand-accents";
import { CHAPTERS } from "@/lib/marketing/nav";

export const metadata: Metadata = {
  title: `${CHAPTERS.resources.chapter} · ${CHAPTERS.resources.title}`,
  description: "A calm collection of Hello to Cheers resources—product, trust, and relationship.",
};

const RESOURCES = [
  {
    href: CHAPTERS.why.href,
    chapter: CHAPTERS.why.chapter,
    title: CHAPTERS.why.title,
    body: "Belief, gratitude, pricing philosophy, and trust—why this company exists.",
  },
  {
    href: CHAPTERS.product.href,
    chapter: CHAPTERS.product.chapter,
    title: CHAPTERS.product.title,
    body: "Follow one booking through the connected Hello to Cheers journey.",
  },
  {
    href: CHAPTERS.features.href,
    chapter: CHAPTERS.features.chapter,
    title: CHAPTERS.features.title,
    body: "Everything included—organized like a product handbook.",
  },
  {
    href: CHAPTERS.pricing.href,
    chapter: CHAPTERS.pricing.chapter,
    title: null,
    body: "Simple monthly plans, founding relationships, and clear philosophy.",
  },
  {
    href: CHAPTERS.trust.href,
    chapter: CHAPTERS.trust.chapter,
    title: CHAPTERS.trust.title,
    body: "Security, privacy, data ownership, and terms written for humans.",
  },
  {
    href: "/our-story#our-first-friends",
    chapter: "Our First Friends",
    title: null,
    body: "A letter of gratitude to the venues we worked with through Weven.",
  },
  {
    href: "/status",
    chapter: "System Status",
    title: null,
    body: "Operational clarity when something needs attention.",
  },
] as const;

/**
 * Resources — light editorial index (footer destination).
 */
export default function ResourcesPage() {
  return (
    <div className="bg-[var(--true-white)] px-6 pt-[140px] pb-28 md:pb-36">
      <div className="mx-auto max-w-[65ch]">
        <p className="text-[0.7125rem] tracking-[0.22em] uppercase text-[var(--heritage-sage)]/82">
          {CHAPTERS.resources.chapter}
        </p>
        <h1 className="mt-8 font-heading text-[2.52rem] font-medium leading-[1.16] tracking-tight text-[var(--forest-sage)] md:text-[4.2rem]">
          {CHAPTERS.resources.title}
        </h1>
        <p className="mt-6 font-heading text-xl leading-snug text-[var(--forest-sage)]/80 md:text-2xl">
          A quieter place to look things up.
        </p>
        <p className="mt-6 font-heading text-xl leading-snug text-[var(--forest-sage)]/80 md:text-2xl">
          Everything we believe, build, and promise—in one place.
        </p>
        <p className="mt-10 max-w-[65ch] text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg">
          Product, trust, and relationship—without hunting through a maze of links.
        </p>

        <ul className="mt-16 space-y-0">
          {RESOURCES.map((item) => (
            <li key={item.href} className="border-t border-[var(--taupe-medium)]/50 py-8">
              <Link href={item.href} className="group block">
                {item.href === CHAPTERS.trust.href ? (
                  <TrustRule className="mb-4" />
                ) : null}
                {item.title ? (
                  <>
                    <p className="text-[0.7125rem] tracking-[0.22em] uppercase text-[var(--heritage-sage)]/82">
                      {item.chapter}
                    </p>
                    <h2 className={`mt-3 font-heading text-2xl text-[var(--forest-sage)] transition duration-200 ease-out group-hover:opacity-[0.96] md:text-[2.1rem]`}>
                      {item.title}
                    </h2>
                  </>
                ) : (
                  <h2 className={`font-heading text-2xl text-[var(--forest-sage)] transition duration-200 ease-out group-hover:opacity-[0.96] md:text-[2.1rem]`}>
                    {item.chapter}
                  </h2>
                )}
                <p className="mt-3 text-base text-[var(--forest-sage)]/65">{item.body}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
