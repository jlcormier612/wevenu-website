import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Resources",
  description: "A calm collection of Wevenu resources—product, trust, and relationship.",
};

const RESOURCES = [
  {
    href: "/why-wevenu",
    title: "Why Wevenu",
    body: "Belief, gratitude, pricing philosophy, and trust—why this company exists.",
  },
  {
    href: "/product",
    title: "Product",
    body: "Follow one booking through the connected Wevenu journey.",
  },
  {
    href: "/features",
    title: "Features",
    body: "Everything included—organized like a product handbook.",
  },
  {
    href: "/pricing",
    title: "Pricing",
    body: "Simple monthly plans, founding relationships, and clear philosophy.",
  },
  {
    href: "/trust",
    title: "Trust",
    body: "Security, privacy, data ownership, and terms written for humans.",
  },
  {
    href: "/why-wevenu#our-first-friends",
    title: "Our First Friends",
    body: "A letter of gratitude for the Weven community.",
  },
  {
    href: "/status",
    title: "System Status",
    body: "Operational clarity when something needs attention.",
  },
] as const;

/**
 * Resources — light editorial index (footer destination).
 */
export default function ResourcesPage() {
  return (
    <div className="bg-[var(--true-white)] px-6 pt-[140px] pb-28 md:pb-36">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs tracking-[0.22em] uppercase text-[var(--heritage-sage)]">
          Resources
        </p>
        <h1 className="mt-5 font-heading text-4xl font-medium text-[var(--forest-sage)] md:text-6xl">
          A quieter place to look things up.
        </h1>
        <p className="mt-8 text-base leading-relaxed text-[var(--forest-sage)]/70 md:text-lg">
          Product, trust, and relationship—without hunting through a maze of links.
        </p>

        <ul className="mt-16 space-y-0">
          {RESOURCES.map((item) => (
            <li key={item.href} className="border-t border-[var(--taupe-medium)]/50 py-8">
              <Link href={item.href} className="group block">
                <h2 className="font-heading text-2xl text-[var(--forest-sage)] transition group-hover:opacity-70 md:text-3xl">
                  {item.title}
                </h2>
                <p className="mt-3 text-base text-[var(--forest-sage)]/65">{item.body}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
