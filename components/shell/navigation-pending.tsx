"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

/**
 * Keep the last painted page visible during App Router navigations.
 *
 * Root cause of white main: sidebar navigations empty the App Router page slot
 * in `main` for a long beat while RSC streams. A skeleton overlay (#124/#125)
 * only covered that emptiness and made the wait feel worse.
 *
 * Fix: on sidebar click, snapshot the current page slot HTML into a sibling
 * overlay (does NOT wrap App Router `children` — that caused #S:0). Keep the
 * snapshot until the new page has usable content. Soft-URL / paging untouched.
 */
const NavigationPendingContext = React.createContext<{
  pendingHref: string | null;
  snapshotHtml: string | null;
  begin: (href: string) => void;
} | null>(null);

const STORAGE_KEY = "htc-nav-pending-href";
const SNAPSHOT_KEY = "htc-nav-pending-snapshot";
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

function readStoredSnapshot(): string | null {
  try {
    const v = sessionStorage.getItem(SNAPSHOT_KEY);
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

function writeStoredPending(href: string | null, snapshotHtml: string | null) {
  try {
    if (!href) {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(SNAPSHOT_KEY);
    } else {
      sessionStorage.setItem(STORAGE_KEY, href);
      if (snapshotHtml) sessionStorage.setItem(SNAPSHOT_KEY, snapshotHtml);
      else sessionStorage.removeItem(SNAPSHOT_KEY);
    }
  } catch {
    /* private mode / quota */
  }
}

function capturePageSlotHtml(): string | null {
  if (typeof document === "undefined") return null;
  const main = document.querySelector("[data-workspace-main]");
  if (!main) return null;
  const pageSlot = main.querySelector(
    ":scope > div:not([data-testid='navigation-pending-main'])",
  );
  if (!pageSlot) return null;
  const text = (pageSlot.textContent ?? "").replace(/\s+/g, " ").trim();
  if (text.length < CONTENT_MIN_CHARS) return null;
  return pageSlot.outerHTML;
}

function mainHasUsableContent(): boolean {
  if (typeof document === "undefined") return false;
  const main = document.querySelector("[data-workspace-main]");
  if (!main) return false;
  const pageSlot = main.querySelector(
    ":scope > div:not([data-testid='navigation-pending-main'])",
  );
  if (!pageSlot) return false;
  const text = (pageSlot.textContent ?? "").replace(/\s+/g, " ").trim();
  if (text.length < CONTENT_MIN_CHARS) return false;
  // Sync module heading (Leads-style first paint) means the destination arrived.
  // Do not keep the freeze-frame up waiting for the full list body.
  if (pageSlot.querySelector(".htc-hospitality-heading")) {
    return true;
  }
  if (pageSlot.querySelector('[data-testid$="-streaming-root"]')) {
    return true;
  }
  if (pageSlot.querySelector('[data-testid="hospitality-route-loading"]') && text.length < 120) {
    return false;
  }
  return true;
}

function atTargetPath(pathname: string, target: string): boolean {
  return pathname === target || pathname.startsWith(`${target}/`);
}

function pageSlotText(): string {
  if (typeof document === "undefined") return "";
  const main = document.querySelector("[data-workspace-main]");
  const pageSlot = main?.querySelector(
    ":scope > div:not([data-testid='navigation-pending-main'])",
  );
  return (pageSlot?.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function NavigationPendingProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = React.useState<string | null>(null);
  const [snapshotHtml, setSnapshotHtml] = React.useState<string | null>(null);
  const stuckTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimer = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const pathnameAtBegin = React.useRef(pathname);
  /** Text fingerprint at click — must change before we clear (avoids clearing on stale old page). */
  const originSlotText = React.useRef("");

  const clearPendingNow = React.useEffectEvent(() => {
    if (stuckTimer.current) {
      clearTimeout(stuckTimer.current);
      stuckTimer.current = null;
    }
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
    writeStoredPending(null, null);
    originSlotText.current = "";
    setPendingHref(null);
    setSnapshotHtml(null);
  });

  const armStuckTimer = React.useEffectEvent(() => {
    if (stuckTimer.current) clearTimeout(stuckTimer.current);
    stuckTimer.current = setTimeout(() => {
      clearPendingNow();
    }, STUCK_CLEAR_MS);
  });

  // Restore after force-dynamic layout remount (snapshot + href).
  React.useLayoutEffect(() => {
    const stored = readStoredPending();
    if (!stored) return;
    pathnameAtBegin.current = pathname;
    setPendingHref(stored);
    setSnapshotHtml(readStoredSnapshot());
    armStuckTimer();
    // intentionally mount-only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!pendingHref) return;
    const target = pathOnly(pendingHref);

    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }

    const tick = () => {
      if (!atTargetPath(pathname, target) && pathname === pathnameAtBegin.current) {
        return;
      }
      if (!atTargetPath(pathname, target)) return;
      if (!mainHasUsableContent()) return;
      // Require the live page slot to differ from the origin page (not stale content).
      const live = pageSlotText();
      if (originSlotText.current && live === originSlotText.current) return;
      clearPendingNow();
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
      if (!pendingHref) clearPendingNow();
      else armStuckTimer();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [pendingHref, clearPendingNow, armStuckTimer]);

  const value = React.useMemo(
    () => ({
      pendingHref,
      snapshotHtml,
      begin: (href: string) => {
        const path = pathOnly(href);
        if (!path || path === pathname) return;
        const snap = capturePageSlotHtml();
        originSlotText.current = pageSlotText();
        pathnameAtBegin.current = pathname;
        writeStoredPending(path, snap);
        setSnapshotHtml(snap);
        setPendingHref(path);
        armStuckTimer();
      },
    }),
    [pendingHref, snapshotHtml, pathname, armStuckTimer],
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
 * Shows a freeze-frame of the previous page while the new route streams in.
 */
export function NavigationPendingMainOverlay() {
  const ctx = React.useContext(NavigationPendingContext);
  const pendingHref = ctx?.pendingHref ?? null;
  const snapshotHtml = ctx?.snapshotHtml ?? null;

  if (!pendingHref || !snapshotHtml) return null;

  return (
    <div
      data-testid="navigation-pending-main"
      data-nav-snapshot="true"
      className="pointer-events-none absolute inset-0 z-[40] overflow-y-auto bg-background"
      aria-busy="true"
      aria-hidden
    >
      <div dangerouslySetInnerHTML={{ __html: snapshotHtml }} />
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
