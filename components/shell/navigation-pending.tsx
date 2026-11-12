"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

/**
 * Immediate soft-nav feedback that does not wait for the server RSC flight.
 * Click sets pending; pathname change / popstate / safety timeout clears.
 * Minimum visible window avoids zero-frame flash on fast mobile navigations.
 * Subtle top edge only — no overlay, no false success.
 */
const NavigationPendingContext = React.createContext<{
  pendingHref: string | null;
  begin: (href: string) => void;
} | null>(null);

const STUCK_CLEAR_MS = 12_000;
/** Keep the bar paintable on fast soft-nav (especially mobile sheet → route). */
const MIN_VISIBLE_MS = 140;

export function NavigationPendingProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = React.useState<string | null>(null);
  const stuckTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const shownAt = React.useRef(0);
  const pathnameAtBegin = React.useRef(pathname);

  const clearPendingNow = React.useEffectEvent(() => {
    if (stuckTimer.current) {
      clearTimeout(stuckTimer.current);
      stuckTimer.current = null;
    }
    if (clearTimer.current) {
      clearTimeout(clearTimer.current);
      clearTimer.current = null;
    }
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

  React.useEffect(() => {
    if (!pendingHref) return;
    if (pathname === pathnameAtBegin.current) return;
    scheduleClearAfterMinVisible();
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
        const path = href.split("?")[0]?.split("#")[0] ?? href;
        if (!path || path === pathname) return;
        pathnameAtBegin.current = pathname;
        shownAt.current = Date.now();
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
