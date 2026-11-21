"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { HospitalityRouteLoading } from "@/components/shell/hospitality-route-loading";

/**
 * Immediate nav feedback that does not wait for the server RSC flight.
 *
 * Why #124 was not enough: we cleared pending when `pathname` matched the
 * target. App Router updates the URL before `main` has streamed content, so
 * the overlay vanished and left a white/cream empty main — the bug users still
 * saw on Sandbox after deploy.
 *
 * Fix: keep pending until `main` has real page content (or stuck timeout).
 * Persist target in sessionStorage so force-dynamic remounts can restore it.
 * Overlay is a sibling inside main — never wraps App Router `children`.
 */
const NavigationPendingContext = React.createContext<{
  pendingHref: string | null;
  begin: (href: string) => void;
} | null>(null);

const STORAGE_KEY = "htc-nav-pending-href";
const STUCK_CLEAR_MS = 12_000;
const CONTENT_POLL_MS = 50;
const CONTENT_MIN_CHARS = 48;

function pathOnly(href: string): string {
  return href.split("?")[0]?.split("#")[0] ?? href;
}

function readStoredPending(): string | null {
  try {
    const v = sessionStorage.getItem(STORAGE_KEY);
    return v && v.startsWith("/") ? v : null;
  } catch {
    return null;
  }
}

function writeStoredPending(href: string | null) {
  try {
    if (!href) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, href);
  } catch {
    /* private mode / quota */
  }
}

function variantForPath(
  pathname: string,
): "dashboard" | "list" | "detail" | "reporting" | "calendar" | "payments" {
  if (pathname === "/dashboard" || pathname === "/") return "dashboard";
  if (pathname.startsWith("/reporting")) return "reporting";
  if (pathname.startsWith("/calendar")) return "calendar";
  if (pathname.startsWith("/payments") || pathname.startsWith("/invoices")) return "payments";
  if (/^\/[^/]+\/[^/]+/.test(pathname)) return "detail";
  return "list";
}

function mainHasUsableContent(): boolean {
  if (typeof document === "undefined") return false;
  const main = document.querySelector("[data-workspace-main]");
  if (!main) return false;
  // Page slot is the first padding wrapper; overlay is a sibling after it.
  const pageSlot = main.querySelector(":scope > div:not([data-testid='navigation-pending-main'])");
  if (!pageSlot) return false;
  const text = (pageSlot.textContent ?? "").replace(/\s+/g, " ").trim();
  if (text.length < CONTENT_MIN_CHARS) return false;
  // Still only a route loading shell inside the page slot.
  if (pageSlot.querySelector('[data-testid="hospitality-route-loading"]') && text.length < 120) {
    return false;
  }
  return true;
}

function atTargetPath(pathname: string, target: string): boolean {
  return pathname === target || pathname.startsWith(`${target}/`);
}

export function NavigationPendingProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = React.useState<string | null>(null);
  const stuckTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimer = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const shownAt = React.useRef(0);
  const pathnameAtBegin = React.useRef(pathname);

  const clearPendingNow = React.useEffectEvent(() => {
    if (stuckTimer.current) {
      clearTimeout(stuckTimer.current);
      stuckTimer.current = null;
    }
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
    writeStoredPending(null);
    setPendingHref(null);
  });

  const armStuckTimer = React.useEffectEvent(() => {
    if (stuckTimer.current) clearTimeout(stuckTimer.current);
    stuckTimer.current = setTimeout(() => {
      clearPendingNow();
    }, STUCK_CLEAR_MS);
  });

  // Restore before paint on mount (survives force-dynamic layout remount).
  // Keep showing even if URL already matches — content may still be empty.
  React.useLayoutEffect(() => {
    const stored = readStoredPending();
    if (!stored) return;
    pathnameAtBegin.current = pathname;
    shownAt.current = Date.now();
    setPendingHref(stored);
    armStuckTimer();
    // intentionally mount-only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clear only once we are on the target AND main has real content.
  React.useEffect(() => {
    if (!pendingHref) return;
    const target = pathOnly(pendingHref);

    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }

    const tick = () => {
      if (!atTargetPath(pathname, target) && pathname === pathnameAtBegin.current) {
        return; // still on origin route
      }
      if (atTargetPath(pathname, target) && mainHasUsableContent()) {
        clearPendingNow();
      }
    };

    tick();
    pollTimer.current = setInterval(tick, CONTENT_POLL_MS);
    return () => {
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    };
  }, [pathname, pendingHref, clearPendingNow]);

  React.useEffect(() => {
    const onPop = () => {
      // Back/forward: keep overlay until content, or clear if nothing pending.
      if (!pendingHref) clearPendingNow();
      else armStuckTimer();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [pendingHref, clearPendingNow, armStuckTimer]);

  const value = React.useMemo(
    () => ({
      pendingHref,
      begin: (href: string) => {
        const path = pathOnly(href);
        if (!path || path === pathname) return;
        pathnameAtBegin.current = pathname;
        shownAt.current = Date.now();
        writeStoredPending(path);
        setPendingHref(path);
        armStuckTimer();
      },
    }),
    [pendingHref, pathname, armStuckTimer],
  );

  return (
    <NavigationPendingContext.Provider value={value}>
      {children}
      <div
        aria-hidden={!pendingHref}
        aria-busy={pendingHref ? true : undefined}
        data-testid="navigation-pending-bar"
        className={
          pendingHref
            ? "pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden bg-transparent"
            : "pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden opacity-0"
        }
      >
        {pendingHref ? (
          <div className="htc-nav-pending-indeterminate h-full w-1/3 bg-[color:var(--htc-botanical)]/85 motion-reduce:animate-none motion-reduce:w-full motion-reduce:opacity-70" />
        ) : null}
      </div>
    </NavigationPendingContext.Provider>
  );
}

/**
 * Sibling overlay inside `<main>` — never wraps the App Router children slot.
 */
export function NavigationPendingMainOverlay() {
  const ctx = React.useContext(NavigationPendingContext);
  const pendingHref = ctx?.pendingHref ?? null;
  if (!pendingHref) return null;

  const variant = variantForPath(pathOnly(pendingHref));

  return (
    <div
      data-testid="navigation-pending-main"
      className="pointer-events-none absolute inset-0 z-[40] overflow-y-auto bg-background"
      aria-busy="true"
    >
      <div className="mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-10">
        <HospitalityRouteLoading variant={variant} label="Loading" />
      </div>
    </div>
  );
}

export function useNavigationPending() {
  return React.useContext(NavigationPendingContext);
}

export function navigationPendingOnClick(
  begin: ((href: string) => void) | undefined,
  href: string,
  extra?: React.MouseEventHandler<HTMLAnchorElement>,
): React.MouseEventHandler<HTMLAnchorElement> {
  return (event) => {
    begin?.(href);
    extra?.(event);
  };
}
