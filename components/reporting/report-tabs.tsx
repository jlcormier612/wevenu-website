"use client";

/**
 * Work Package R1 — shallow Reporting navigation (brief §4/§61):
 * Overview / Sales / Bookings / Revenue / Events / Saved.
 * Preserves date-range search params on every tab link (except Saved).
 *
 * Phase 10 polish — mobile: keep horizontal scroll, scroll the active tab
 * into view on route change, and show quiet edge affordances when more tabs
 * exist offscreen. Chevrons sit in reserved edge slots (not over labels).
 * Phase 11B final polish — stronger edge fades so clipped neighbor labels do
 * not read as awkward fragments; active tab is centered when possible.
 * Desktop layout unchanged.
 */
import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

export const REPORT_TABS = [
  { href: "/reporting", label: "Overview" },
  { href: "/reporting/sales", label: "Sales" },
  { href: "/reporting/bookings", label: "Bookings" },
  { href: "/reporting/revenue", label: "Revenue" },
  { href: "/reporting/events", label: "Events" },
  { href: "/reporting/saved", label: "Saved" },
] as const;

function isActiveTab(pathname: string, href: string) {
  return href === "/reporting" ? pathname === "/reporting" : pathname.startsWith(href);
}

function scrollActiveIntoView(scroller: HTMLElement) {
  const active = scroller.querySelector<HTMLElement>('[data-report-tab-active="true"]');
  if (!active) return;
  // Prefer centering the active tab so neighbor fragments sit under edge fades.
  const max = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
  const centered = active.offsetLeft - (scroller.clientWidth - active.offsetWidth) / 2;
  const next = Math.max(0, Math.min(max, centered));
  if (Math.abs(next - scroller.scrollLeft) > 1) {
    scroller.scrollTo({ left: next, behavior: "smooth" });
  }
}

export function ReportTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const scrollerRef = React.useRef<HTMLElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);
  /** Once tabs overflow the strip, keep both edge slots so chevron space stays stable. */
  const [needsEdgeSlots, setNeedsEdgeSlots] = React.useState(false);

  const updateOverflow = React.useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const left = el.scrollLeft > 2;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    const overflows = el.scrollWidth > el.clientWidth + 2;
    setCanScrollLeft(left);
    setCanScrollRight(right);
    setNeedsEdgeSlots((prev) => prev || overflows || left || right);
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
  }, [updateOverflow, pathname]);

  // Bring the active tab fully into view after route navigation / edge-slot layout.
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
  }, [pathname, needsEdgeSlots, updateOverflow]);

  function scrollByPage(dir: -1 | 1) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.55, 96), behavior: "smooth" });
  }

  const showLeftSlot = needsEdgeSlots;
  const showRightSlot = needsEdgeSlots;

  // Aggressive directional fade: opaque canvas near the edge so clipped neighbor
  // letters never read as awkward fragments; then soft blend into readable labels.
  const edgeFadePx = 72;
  const leftFade = canScrollLeft
    ? `transparent 0, transparent 28px, rgba(0,0,0,0.15) 48px, #000 ${edgeFadePx}px`
    : "#000 0";
  const rightFade = canScrollRight
    ? `#000 calc(100% - ${edgeFadePx}px), rgba(0,0,0,0.15) calc(100% - 48px), transparent calc(100% - 28px), transparent 100%`
    : "#000 100%";
  const maskGradient = `linear-gradient(to right, ${leftFade}, ${rightFade})`;
  const scrollerMask =
    canScrollLeft || canScrollRight
      ? { WebkitMaskImage: maskGradient, maskImage: maskGradient }
      : undefined;

  return (
    <div className="min-w-0" data-htc-report-tabs="shell">
      <div className="flex min-w-0 items-stretch">
        {/* Reserved left edge — chevron never overlays tab labels */}
        <div
          className={cn(
            "shrink-0 items-center justify-center border-b border-border",
            showLeftSlot ? "flex w-9 md:hidden" : "hidden",
          )}
          data-htc-report-tabs-edge="left"
          data-htc-report-tabs-edge-active={canScrollLeft ? "true" : "false"}
        >
          {canScrollLeft ? (
            <button
              type="button"
              aria-label="Show previous report tabs"
              onClick={() => scrollByPage(-1)}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-[var(--htc-canvas,#F8F7F3)] text-muted-foreground"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        <div className="relative min-w-0 flex-1 overflow-hidden">
          {canScrollLeft ? (
            <>
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 z-10 w-7 bg-[var(--htc-canvas,#F8F7F3)] md:hidden"
                data-htc-report-tabs-fade-cap="left"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 z-10 w-[4.5rem] bg-gradient-to-r from-[var(--htc-canvas,#F8F7F3)] from-50% to-transparent md:hidden"
                data-htc-report-tabs-fade="left"
              />
            </>
          ) : null}
          {canScrollRight ? (
            <>
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 right-0 z-10 w-7 bg-[var(--htc-canvas,#F8F7F3)] md:hidden"
                data-htc-report-tabs-fade-cap="right"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 right-0 z-10 w-[4.5rem] bg-gradient-to-l from-[var(--htc-canvas,#F8F7F3)] from-50% to-transparent md:hidden"
                data-htc-report-tabs-fade="right"
              />
            </>
          ) : null}
          <nav
            ref={scrollerRef}
            className="flex items-center gap-1 overflow-x-auto border-b border-border [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            style={scrollerMask}
            aria-label="Reports"
            data-htc-report-tabs="scroller"
            data-htc-report-tabs-mask={canScrollLeft || canScrollRight ? "edge-fade" : "none"}
          >
            {REPORT_TABS.map((tab) => {
              const active = isActiveTab(pathname, tab.href);
              const href = tab.href === "/reporting/saved" ? tab.href : qs ? `${tab.href}?${qs}` : tab.href;
              return (
                <Link
                  key={tab.href}
                  href={href}
                  data-report-tab={tab.label.toLowerCase()}
                  data-report-tab-active={active ? "true" : "false"}
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

        {/* Reserved right edge — chevron never overlays tab labels */}
        <div
          className={cn(
            "shrink-0 items-center justify-center border-b border-border",
            showRightSlot ? "flex w-9 md:hidden" : "hidden",
          )}
          data-htc-report-tabs-edge="right"
          data-htc-report-tabs-edge-active={canScrollRight ? "true" : "false"}
        >
          {canScrollRight ? (
            <button
              type="button"
              aria-label="Show more report tabs"
              onClick={() => scrollByPage(1)}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-[var(--htc-canvas,#F8F7F3)] text-muted-foreground"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
