"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { MARKETING_MEDIA } from "@/lib/marketing/content";
import { LOGIN_LINKS, MARKETING_NAV, PRIMARY_CTA } from "@/lib/marketing/nav";
import { cn } from "@/lib/utils";

import { MarketingCta } from "./marketing-cta";

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--taupe-medium)]/40 bg-[var(--header-linen)]/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6 md:h-20">
        <Link href="/" className="relative flex h-8 w-[140px] shrink-0 items-center md:h-9 md:w-[168px]">
          <Image
            src={MARKETING_MEDIA.logo}
            alt="Wevenu"
            fill
            className="object-contain object-left"
            priority
          />
        </Link>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary">
          {MARKETING_NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "text-sm tracking-wide transition-colors",
                  active
                    ? "text-[var(--forest-sage)]"
                    : "text-[var(--forest-sage)]/65 hover:text-[var(--forest-sage)]",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <div className="relative">
            <button
              type="button"
              onClick={() => setLoginOpen((v) => !v)}
              onBlur={() => setTimeout(() => setLoginOpen(false), 150)}
              className="px-2 py-1.5 text-sm text-[var(--forest-sage)]/75 hover:text-[var(--forest-sage)]"
              aria-expanded={loginOpen}
              aria-haspopup="menu"
            >
              Login
            </button>
            {loginOpen ? (
              <div
                role="menu"
                className="absolute right-0 mt-2 min-w-[10rem] rounded-2xl border border-[var(--taupe-light)] bg-[var(--true-white)] py-2 shadow-sm"
              >
                {LOGIN_LINKS.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    role="menuitem"
                    className="block px-4 py-2 text-sm text-[var(--forest-sage)] hover:bg-[var(--linen)]"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
          <MarketingCta className="!px-5 !py-2.5 text-[13px]" />
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--taupe-light)] text-[var(--forest-sage)] lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="sr-only">Menu</span>
          <span aria-hidden className="flex flex-col gap-1.5">
            <span className={cn("h-px w-4 bg-current transition", open && "translate-y-[3.5px] rotate-45")} />
            <span className={cn("h-px w-4 bg-current transition", open && "opacity-0")} />
            <span className={cn("h-px w-4 bg-current transition", open && "-translate-y-[3.5px] -rotate-45")} />
          </span>
        </button>
      </div>

      {open ? (
        <div className="border-t border-[var(--taupe-medium)]/40 bg-[var(--header-linen)] px-6 py-6 lg:hidden">
          <nav className="flex flex-col gap-4" aria-label="Mobile">
            {MARKETING_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="text-base text-[var(--forest-sage)]"
              >
                {item.label}
              </Link>
            ))}
            <div className="pt-2">
              <p className="mb-2 text-xs uppercase tracking-[0.18em] text-[var(--heritage-sage)]">
                Login
              </p>
              <div className="flex flex-wrap gap-3">
                {LOGIN_LINKS.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    className="text-sm text-[var(--forest-sage)]/80"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
            <MarketingCta
              href={PRIMARY_CTA.href}
              label={PRIMARY_CTA.label}
              className="mt-2 w-full"
            />
          </nav>
        </div>
      ) : null}
    </header>
  );
}
