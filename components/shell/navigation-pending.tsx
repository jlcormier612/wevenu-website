"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { HospitalityRouteLoading } from "@/components/shell/hospitality-route-loading";

/**
 * Immediate soft-nav feedback that does not wait for the server RSC flight.
 * Click sets pending (React state + sessionStorage so a layout remount cannot
 * wipe the indicator). Pathname match / popstate / safety timeout clears.
 *
 * Main overlay: document navigations previously left `main` empty (white
 * screen) while only a hairline top bar showed. Overlay fills main without
 * wrapping the App Router `children` slot (that + loading.tsx caused #S:0).
 */
const NavigationPendingContext = React.createContext<{
  pendingHref: string | null;
  begin: (href: string) => void;
} | null>(null);

const STORAGE_KEY = "htc-nav-pending-href";
const STUCK_CLEAR_MS = 12_000;
/** Keep the bar/overlay paintable on fast soft-nav. */
const MIN_VISIBLE_MS = 140;

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
    /* private mode / quota — state-only fallback */
  }
}

function variantForPath(pathname: string): "dashboard" | "list" | "detail" | "reporting" | "calendar" | "payments" {
  if (pathname === "/dashboard" || pathname === "/") return "dashboard";
  if (pathname.startsWith("/reporting")) return "reporting";
  if (pathname.startsWith("/calendar")) return "calendar";
  if (pathname.startsWith("/payments") || pathname.startsWith("/invoices")) return "payments";
  // /leads/<uuid>, /clients/<uuid>, /events/<uuid>, …
  if (/^\/[^/]+\/[^/]+/.test(pathname)) return "detail";
  return "list";
}

export function NavigationPendingProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = React.useState<string | null>(null);
  const stuckTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const shownAt = React.useRef(0);
  const pathnameAtBegin = React.useRef(pathname);
  const hydrated = React.useRef(false);

  const clearPendingNow = React.useEffectEvent(() => {
    if (stuckTimer.current) {
      clearTimeout(stuckTimer.current);
      stuckTimer.current = null;
    }
    if (clearTimer.current) {
      clearTimeout(clearTimer.current);
      clearTimer.current = null;
    }
    writeStoredPending(null);
    setPendingHref(null);
  });

  const scheduleClearAfterMinVisible = React.useEffectEvent(() => {
    if (clearTimer.current) {
      clearTimeout(clearTimer.current);
      clearTimer.current = null;
    }
    const elapsed = shownAt.current ? Date.now() - shownAt.current : MIN_VISIBLE_MS;
    const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
    clearTimer.current = setTimeout(() => {
      clearPendingNow();
    }, wait);
  });

  // Survive force-dynamic layout remount: restore pending from sessionStorage.
  React.useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const stored = readStoredPending();
    if (!stored) return;
    if (pathname === stored || pathname.startsWith(`${stored}/`)) {
      writeStoredPending(null);
      return;
    }
    pathnameAtBegin.current = pathname;
    shownAt.current = Date.now();
    setPendingHref(stored);
    stuckTimer.current = setTimeout(() => {
      clearPendingNow();
    }, STUCK_CLEAR_MS);
  }, [pathname, clearPendingNow]);

  React.useEffect(() => {
    if (!pendingHref) return;
    const target = pathOnly(pendingHref);
    if (pathname === pathnameAtBegin.current) return;
    if (pathname === target || pathname.startsWith(`${target}/`)) {
      scheduleClearAfterMinVisible();
    }
  }, [pathname, pendingHref, scheduleClearAfterMinVisible]);

  React.useEffect(() => {
    const onPop = () => {
      if (pendingHref) scheduleClearAfterMinVisible();
      else clearPendingNow();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [pendingHref, scheduleClearAfterMinVisible, clearPendingNow]);

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
        if (stuckTimer.current) clearTimeout(stuckTimer.current);
        stuckTimer.current = setTimeout(() => {
          clearPendingNow();
        }, STUCK_CLEAR_MS);
      },
    }),
    [pendingHref, pathname, clearPendingNow],
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
