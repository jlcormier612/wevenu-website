"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import { HTC_LOGO_PUBLIC_PATH } from "@shared/brand/logo";
import { cn } from "@/lib/utils";

type WorkspaceChromeProps = {
  homeHref: string;
  sidebar: React.ReactNode;
  topBar: React.ReactNode;
  banner?: React.ReactNode;
  children: React.ReactNode;
};

/**
 * Responsive shell: fixed desktop sidebar; mobile drawer + compact header.
 * Visual foundation only — does not change nav destinations or permissions.
 */
export function WorkspaceChrome({
  homeHref,
  sidebar,
  topBar,
  banner,
  children,
}: WorkspaceChromeProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-[var(--htc-border)] bg-[var(--htc-warm-white)] px-4 md:hidden">
        <Link href={homeHref} className="flex min-w-0 items-center gap-2" aria-label="Hello to Cheers Relationship Workspace">
          <Image
            src={HTC_LOGO_PUBLIC_PATH}
            alt="Hello to Cheers"
            width={755}
            height={274}
            className="h-7 w-auto max-w-[9.5rem]"
            priority
          />
        </Link>
        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] border border-[var(--htc-border)] bg-[var(--htc-linen)] text-[var(--htc-forest)]"
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
        >
          <span aria-hidden="true" className="text-lg leading-none">
            {mobileOpen ? "✕" : "☰"}
          </span>
        </button>
      </div>

      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-[color-mix(in_srgb,var(--htc-text)_35%,transparent)] md:hidden"
          aria-label="Close navigation overlay"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[var(--sidebar-width)] transition-transform duration-200 md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
        onClick={(e) => {
          const t = e.target as HTMLElement;
          if (t.closest("a")) setMobileOpen(false);
        }}
      >
        {sidebar}
      </div>

      <div className="md:pl-[var(--sidebar-width)]">
        {banner}
        {topBar}
        <main className="ws-enter mx-auto w-full max-w-[1440px] px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
