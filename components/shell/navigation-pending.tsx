"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

/**
 * Immediate soft-nav feedback that does not wait for the server RSC flight.
 * Click sets pending; pathname change / popstate / safety timeout clears.
 * Subtle top edge only — no overlay, no false success.
 */
const NavigationPendingContext = React.createContext<{
  pendingHref: string | null;
  begin: (href: string) => void;
} | null>(null);

const STUCK_CLEAR_MS = 12_000;

export function NavigationPendingProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = React.useState<string | null>(null);
  const stuckTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPending = React.useEffectEvent(() => {
    if (stuckTimer.current) {
      clearTimeout(stuckTimer.current);
      stuckTimer.current = null;
    }
    setPendingHref(null);
  });

  React.useEffect(() => {
    clearPending();
  }, [pathname, clearPending]);

  React.useEffect(() => {
    const onPop = () => clearPending();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [clearPending]);

  const value = React.useMemo(
    () => ({
      pendingHref,
      begin: (href: string) => {
        const path = href.split("?")[0]?.split("#")[0] ?? href;
        if (!path || path === pathname) return;
        setPendingHref(path);
        if (stuckTimer.current) clearTimeout(stuckTimer.current);
        stuckTimer.current = setTimeout(() => {
          setPendingHref(null);
          stuckTimer.current = null;
        }, STUCK_CLEAR_MS);
      },
    }),
    [pendingHref, pathname],
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
