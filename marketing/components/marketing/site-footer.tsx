import Image from "next/image";
import Link from "next/link";

import { MarketingCta } from "@/components/marketing/marketing-cta";
import { MARKETING_MEDIA } from "@/lib/marketing/content";
import {
  FOOTER_EXPLORE,
  FOOTER_LEGAL,
  FOOTER_TRUST_SUPPORT,
  PRIMARY_CTA,
} from "@/lib/marketing/nav";
import { TYPE_LABEL } from "@/lib/marketing/rhythm";

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--taupe-medium)]/55 bg-[var(--header-linen)] px-6 py-16 md:py-20">
      <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-2 md:gap-x-12 md:gap-y-14 lg:grid-cols-[1.35fr_1fr_1fr_1.15fr] lg:gap-x-14">
        <div className="md:col-span-2 lg:col-span-1">
          <Link
            href="/"
            className="relative mb-6 block h-[4.6rem] w-[276px] max-w-full rounded-sm outline-none transition-opacity duration-200 ease-out hover:opacity-[0.96] focus-visible:ring-2 focus-visible:ring-[var(--botanical)] focus-visible:ring-offset-4"
          >
            <Image
              src={MARKETING_MEDIA.logo}
              alt="Hello to Cheers"
              fill
              unoptimized
              className="object-contain object-left"
            />
          </Link>
          <h2 className="max-w-sm font-heading text-[1.65rem] font-medium leading-[1.25] tracking-tight text-[var(--botanical)] md:text-[1.85rem]">
            Every detail, thoughtfully connected.
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-[1.7] text-[var(--forest-sage)]/92 md:text-[0.9375rem]">
            A more beautiful way to run your venue, from first inquiry to final
            farewell.
          </p>
        </div>

        <div>
          <p className={`mb-4 ${TYPE_LABEL}`}>Explore</p>
          <ul className="space-y-2.5">
            {FOOTER_EXPLORE.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-sm text-[var(--forest-sage)] underline-offset-4 transition-colors duration-200 ease-out hover:underline hover:text-[var(--botanical)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--botanical)] focus-visible:ring-offset-2"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className={`mb-4 ${TYPE_LABEL}`}>Trust &amp; Support</p>
          <ul className="space-y-2.5">
            {FOOTER_TRUST_SUPPORT.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-sm text-[var(--forest-sage)] underline-offset-4 transition-colors duration-200 ease-out hover:underline hover:text-[var(--botanical)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--botanical)] focus-visible:ring-offset-2"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          <p className={`mb-3 mt-8 ${TYPE_LABEL}`}>Legal</p>
          <ul className="space-y-2">
            {FOOTER_LEGAL.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-[0.8125rem] leading-snug text-[var(--forest-sage)]/90 underline-offset-4 transition-colors duration-200 ease-out hover:underline hover:text-[var(--botanical)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--botanical)] focus-visible:ring-offset-2"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="rounded-sm border border-[var(--taupe-medium)]/45 bg-[var(--true-white)] px-5 py-6 shadow-[0_18px_40px_-34px_rgba(47,55,47,0.28)] md:px-6 md:py-7">
            <h3 className="font-heading text-[1.35rem] font-medium leading-[1.3] tracking-tight text-[var(--botanical)]">
              Let&apos;s make something wonderful together.
            </h3>
            <p className="mt-3 mb-6 text-sm leading-[1.7] text-[var(--forest-sage)]/90">
              See how Hello to Cheers can bring more ease, clarity, and
              connection to your venue.
            </p>
            <MarketingCta
              href={PRIMARY_CTA.href}
              label={PRIMARY_CTA.label}
              variant="primary"
              className="w-full px-5 text-center leading-snug sm:px-6"
            />
          </div>
        </div>
      </div>

      <div className="mx-auto mt-14 flex max-w-6xl flex-col gap-3 border-t border-[var(--taupe-medium)]/50 pt-7 text-sm text-[var(--forest-sage)]/78 md:flex-row md:items-center md:justify-between">
        <p>© {new Date().getFullYear()} Hello to Cheers</p>
        <p className="max-w-md md:text-right">
          Thoughtfully made for the people behind every celebration.
        </p>
      </div>
    </footer>
  );
}
