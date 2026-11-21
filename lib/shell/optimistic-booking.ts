/**
 * Chrome-only optimistic booking title while /clients/[id] RSC streams.
 * No status/actions — server identity remains authoritative.
 */

export const OPTIMISTIC_BOOKING_KEY = "htc-optimistic-booking";

export type OptimisticBooking = {
  path: string;
  title: string;
};

const CLIENT_DETAIL_RE = /^\/clients\/[0-9a-f-]{36}$/i;

export function isClientDetailPath(path: string): boolean {
  return CLIENT_DETAIL_RE.test(path.split("?")[0]?.split("#")[0] ?? path);
}

export function readOptimisticBooking(): OptimisticBooking | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(OPTIMISTIC_BOOKING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OptimisticBooking>;
    if (
      typeof parsed.path !== "string" ||
      !isClientDetailPath(parsed.path) ||
      typeof parsed.title !== "string" ||
      parsed.title.trim().length < 1 ||
      parsed.title.length > 160
    ) {
      return null;
    }
    return { path: parsed.path, title: parsed.title.trim() };
  } catch {
    return null;
  }
}

export function writeOptimisticBooking(entry: OptimisticBooking | null): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    if (!entry) {
      sessionStorage.removeItem(OPTIMISTIC_BOOKING_KEY);
      return;
    }
    if (!isClientDetailPath(entry.path) || !entry.title.trim()) {
      sessionStorage.removeItem(OPTIMISTIC_BOOKING_KEY);
      return;
    }
    sessionStorage.setItem(
      OPTIMISTIC_BOOKING_KEY,
      JSON.stringify({
        path: entry.path.split("?")[0]?.split("#")[0] ?? entry.path,
        title: entry.title.trim().slice(0, 160),
      }),
    );
  } catch {
    /* private mode / quota */
  }
}
