"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { MARKETING_MEDIA } from "@/lib/marketing/content";
import { LOGIN_LINKS, MARKETING_NAV, PRIMARY_CTA } from "@/lib/marketing/nav";
import { HOVER_NAV, HOVER_WHISPER, TYPE_LABEL } from "@/lib/marketing/rhythm";
import { cn } from "@/lib/utils";

import { MarketingCta } from "./marketing-cta";

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-[rgba(36,51,43,0.10)] bg-[#FFFFFF]">
      <div className="mx-auto flex h-[5.2rem] max-w-6xl items-center justify-between gap-4 px-6 md:h-24 lg:grid lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center lg:gap-6">
        <Link
          href="/"
          className={cn(
            // Hug the logo artwork (not an oversized fixed box) so desktop nav
            // centers in the real visual gap between logo ink and the CTA.
            "relative flex h-16 max-w-[calc(100%-3.5rem)] shrink-0 items-center rounded-sm md:max-w-none",
            "outline-none transition-opacity duration-200 ease-out hover:opacity-[0.96]",
            "focus-visible:ring-2 focus-visible:ring-[var(--botanical)] focus-visible:ring-offset-4",
          )}
        >
          <Image
            src={MARKETING_MEDIA.logo}
            alt="Hello to Cheers"
            width={755}
            height={274}
            unoptimized
            className="h-16 w-auto max-w-full object-contain object-left"
            priority
          />
        </Link>

        {/* Desktop: nav + Log In centered in the free space between logo and primary CTA */}
        <div className="hidden min-w-0 items-center justify-center gap-8 lg:flex">
          <nav className="flex items-center gap-8" aria-label="Primary">
            {MARKETING_NAV.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative whitespace-nowrap text-[0.9375rem] tracking-[0.02em] transition-colors duration-200 ease-out",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--heritage-sage)]",
                    active
                      ? "font-medium text-[var(--forest-sage)] after:absolute after:inset-x-0 after:-bottom-1 after:h-px after:bg-[var(--heritage-sage)]"
                      : `text-[var(--forest-sage)]/88 hover:text-[var(--forest-sage)]`,
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setLoginOpen((v) => !v)}
              onBlur={() => setTimeout(() => setLoginOpen(false), 150)}
              className={cn(
                `px-2 py-1.5 text-[0.9375rem] tracking-[0.02em] text-[var(--forest-sage)]/80 ${HOVER_NAV}`,
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--heritage-sage)]",
              )}
              aria-expanded={loginOpen}
              aria-haspopup="menu"
            >
              Log In
            </button>
            {loginOpen ? (
              <div
                role="menu"
                className="absolute left-1/2 mt-2 min-w-[10rem] -translate-x-1/2 rounded-sm border border-[var(--taupe-light)] bg-[var(--true-white)] py-2 shadow-sm"
              >
                {LOGIN_LINKS.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    role="menuitem"
                    className={`block px-4 py-2 text-sm text-[var(--forest-sage)] ${HOVER_WHISPER}`}
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="hidden lg:block">
          <MarketingCta className="!px-5 !py-2.5 text-[13px]" variant="primary" />
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--taupe-light)] text-[var(--forest-sage)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--heritage-sage)] lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="sr-only">Menu</span>
          <span aria-hidden className="flex flex-col gap-1.5">
            <span
              className={cn(
                "h-px w-4 bg-current transition duration-200 ease-out",
                open && "translate-y-[3.5px] rotate-45",
              )}
            />
            <span
              className={cn(
                "h-px w-4 bg-current transition duration-200 ease-out",
                open && "opacity-0",
              )}
            />
            <span
              className={cn(
                "h-px w-4 bg-current transition duration-200 ease-out",
                open && "-translate-y-[3.5px] -rotate-45",
              )}
            />
          </span>
        </button>
      </div>

      {open ? (
        <div className="border-t border-[rgba(36,51,43,0.10)] bg-[#FFFFFF] px-6 py-6 lg:hidden">
          <nav className="flex flex-col gap-4" aria-label="Mobile">
            {MARKETING_NAV.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "text-base tracking-[0.02em] text-[var(--forest-sage)]",
                    active && "font-medium underline decoration-[var(--heritage-sage)] underline-offset-4",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
            <div className="pt-2">
              <p className={`mb-2 ${TYPE_LABEL}`}>Log In</p>
              <div className="flex flex-wrap gap-3">
                {LOGIN_LINKS.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    className="text-sm text-[var(--forest-sage)]/85"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
            <MarketingCta
              href={PRIMARY_CTA.href}
              label={PRIMARY_CTA.label}
              variant="primary"
              className="mt-2 w-full"
            />
          </nav>
        </div>
      ) : null}
    </header>
  );
}
