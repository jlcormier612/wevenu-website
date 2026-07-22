import Image from "next/image";
import Link from "next/link";

import { TrustRule } from "@/components/marketing/brand-accents";
import { NewsletterSignup } from "@/components/marketing/newsletter-signup";
import { MARKETING_MEDIA } from "@/lib/marketing/content";
import { FOOTER_EXPLORE, FOOTER_TRUST, PRIMARY_CTA } from "@/lib/marketing/nav";
import { HOVER_LINK, TYPE_LABEL } from "@/lib/marketing/rhythm";

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--taupe-medium)]/50 bg-[var(--header-linen)] px-6 py-16">
      <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:gap-x-[68px] md:gap-y-12">
        <div>
          <Link href="/" className="relative mb-5 block h-[4.6rem] w-[276px]">
            <Image
              src={MARKETING_MEDIA.logo}
              alt="Hello to Cheers"
              fill
              className="object-contain object-left"
            />
          </Link>
          <p className="max-w-sm text-sm leading-[1.7] text-[var(--forest-sage)]/70">
            The comprehensive operating system for wedding and event venues —
            elegant, organized, thoughtful, and effortless.
          </p>
          <Link
            href={PRIMARY_CTA.href}
            className={`mt-6 inline-block text-sm text-[var(--forest-sage)] ${HOVER_LINK}`}
          >
            {PRIMARY_CTA.label}
          </Link>
        </div>

        <div>
          <p className={`mb-4 ${TYPE_LABEL}`}>Explore</p>
          <ul className="space-y-2.5">
            {FOOTER_EXPLORE.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`text-sm text-[var(--forest-sage)]/80 ${HOVER_LINK}`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <TrustRule className="mb-4" />
          <p className={`mb-4 ${TYPE_LABEL}`}>Trust</p>
          <ul className="space-y-2.5">
            {FOOTER_TRUST.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`text-sm text-[var(--forest-sage)]/80 ${HOVER_LINK}`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className={`mb-4 ${TYPE_LABEL}`}>Stay Connected</p>
          <p className="mb-4 text-sm leading-[1.7] text-[var(--forest-sage)]/70">
            Occasional notes for venue operators — no spam.
          </p>
          <NewsletterSignup />
        </div>
      </div>

      <div className="mx-auto mt-14 flex max-w-6xl flex-col gap-2 border-t border-[var(--taupe-light)] pt-6 text-xs text-[var(--forest-sage)]/50 md:flex-row md:justify-between">
        <p>© {new Date().getFullYear()} Hello to Cheers</p>
        <p>Trust isn&apos;t asked for. It&apos;s earned.</p>
      </div>
    </footer>
  );
}
