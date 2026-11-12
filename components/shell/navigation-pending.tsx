"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

/**
 * Immediate soft-nav feedback that does not wait for the server RSC flight.
 * Click sets pending; pathname change clears. Subtle top edge only — no overlay.
 */
const NavigationPendingContext = React.createContext<{
  pendingHref: string | null;
  begin: (href: string) => void;
} | null>(null);

export function NavigationPendingProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = React.useState<string | null>(null);

  React.useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  const value = React.useMemo(
    () => ({
      pendingHref,
      begin: (href: string) => {
        const path = href.split("?")[0]?.split("#")[0] ?? href;
        if (!path || path === pathname) return;
        setPendingHref(path);
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
          <div className="htc-nav-pending-indeterminate h-full w-1/3 bg-[color:var(--htc-botanical)]/85" />
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
