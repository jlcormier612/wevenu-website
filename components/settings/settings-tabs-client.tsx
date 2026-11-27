"use client";

/**
 * Settings sub-navigation across category pages.
 * Referral tab is gated by the server-provided showReferrals flag.
 *
 * Narrow overflow fix: when tabs exceed the viewport (Refer a Venue often
 * sits past the right edge on laptop widths), keep every tab reachable via
 * horizontal scroll, scroll the active tab into view, and show quiet edge
 * fades so overflow is discoverable — matching Reporting tab affordances.
 */
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const BASE_TABS = [
  { href: "/settings/business", label: "Business & Brand" },
  { href: "/settings/leads", label: "Leads & Booking" },
  { href: "/settings/availability", label: "Availability & Capacity" },
  { href: "/settings/communications", label: "Communications & Automation" },
  { href: "/settings/integrations", label: "Financials & Integrations" },
  { href: "/settings/billing", label: "Subscription & Billing" },
  { href: "/settings/team", label: "Team & Data" },
] as const;

const REFERRAL_TAB = {
  href: "/settings/referrals",
  label: "Refer a Venue",
} as const;

function scrollActiveIntoView(scroller: HTMLElement) {
  const active = scroller.querySelector<HTMLElement>('[data-settings-tab-active="true"]');
  if (!active) return;
  const max = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
  const centered = active.offsetLeft - (scroller.clientWidth - active.offsetWidth) / 2;
  const next = Math.max(0, Math.min(max, centered));
  if (Math.abs(next - scroller.scrollLeft) > 1) {
    scroller.scrollTo({ left: next, behavior: "smooth" });
  }
}

export function SettingsTabsClient({
  showReferrals = false,
}: {
  showReferrals?: boolean;
}) {
  const pathname = usePathname();
  const tabs = showReferrals
    ? [
        ...BASE_TABS.slice(0, 6),
        REFERRAL_TAB,
        ...BASE_TABS.slice(6),
      ]
    : [...BASE_TABS];

  const scrollerRef = React.useRef<HTMLElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);

  const updateOverflow = React.useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  React.useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateOverflow();
    el.addEventListener("scroll", updateOverflow, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateOverflow) : null;
    ro?.observe(el);
    const raf = requestAnimationFrame(() => updateOverflow());
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", updateOverflow);
      ro?.disconnect();
    };
  }, [updateOverflow, pathname, showReferrals]);

  React.useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const raf = requestAnimationFrame(() => {
      scrollActiveIntoView(el);
      window.setTimeout(() => {
        updateOverflow();
        scrollActiveIntoView(el);
      }, 320);
    });
    return () => cancelAnimationFrame(raf);
  }, [pathname, showReferrals, updateOverflow]);

  return (
    <div className="relative w-full min-w-0" data-testid="settings-tabs">
      {canScrollLeft ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-[var(--htc-canvas,#F8F7F3)] to-transparent"
          data-settings-tabs-fade="left"
        />
      ) : null}
      {canScrollRight ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-[var(--htc-canvas,#F8F7F3)] to-transparent"
          data-settings-tabs-fade="right"
        />
      ) : null}
      <nav
        ref={scrollerRef}
        className="flex w-full min-w-0 items-center gap-1 overflow-x-auto overscroll-x-contain border-b border-border [scrollbar-width:thin]"
        aria-label="Settings"
      >
        {tabs.map((tab) => {
          const active = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              data-settings-tab={tab.label}
              data-settings-tab-active={active ? "true" : "false"}
              className={cn(
                "shrink-0 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                active
                  ? "border-primary text-heading"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
