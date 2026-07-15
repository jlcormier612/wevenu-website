import Image from "next/image";
import Link from "next/link";

import { MARKETING_MEDIA } from "@/lib/marketing/content";
import { MARKETING_NAV, PRIMARY_CTA } from "@/lib/marketing/nav";

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--taupe-medium)]/50 bg-[var(--header-linen)] px-6 py-16">
      <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <Link href="/" className="relative mb-5 block h-8 w-[150px]">
            <Image
              src={MARKETING_MEDIA.logo}
              alt="Wevenu"
              fill
              className="object-contain object-left"
            />
          </Link>
          <p className="max-w-sm text-sm leading-relaxed text-[var(--forest-sage)]/70">
            The operating system for independent wedding and event venues —
            elegant, organized, thoughtful, and effortless.
          </p>
        </div>

        <div>
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-[var(--heritage-sage)]">
            Explore
          </p>
          <ul className="space-y-3">
            {MARKETING_NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-sm text-[var(--forest-sage)]/80 hover:text-[var(--forest-sage)]"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-[var(--heritage-sage)]">
            Begin
          </p>
          <Link
            href={PRIMARY_CTA.href}
            className="text-sm text-[var(--forest-sage)] underline-offset-4 hover:underline"
          >
            {PRIMARY_CTA.label}
          </Link>
        </div>
      </div>

      <div className="mx-auto mt-14 flex max-w-6xl flex-col gap-2 border-t border-[var(--taupe-light)] pt-6 text-xs text-[var(--forest-sage)]/50 md:flex-row md:justify-between">
        <p>© {new Date().getFullYear()} Wevenu</p>
        <p>Calm. Classy. Elegant.</p>
      </div>
    </footer>
  );
}
