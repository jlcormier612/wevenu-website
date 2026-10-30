/**
 * Event Order share links must open the Event Order document.
 * A hash-only URL (#event-order) is dropped by email click-tracking and
 * lands on the couple portal home. Financial tokens always render the invoice.
 */

export type PortalSessionAccess = {
  accessToken: string;
  accessLevel: string;
};

export function pickEventOrderPortalSession<T extends PortalSessionAccess>(
  sessions: readonly T[],
): T | null {
  return (
    sessions.find((s) => s.accessLevel === "couple" && s.accessToken)
    ?? sessions.find((s) => s.accessLevel === "planning" && s.accessToken)
    ?? null
  );
}

/** Query survives email click-tracking that drops URL fragments. */
export function eventOrderReviewUrl(origin: string, accessToken: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/p/${encodeURIComponent(accessToken)}?view=event-order#event-order`;
}

/** Secret couple document link — opens only the Event Order (like /offer and /sign). */
export function eventOrderDocumentUrl(origin: string, reviewToken: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/order/${encodeURIComponent(reviewToken)}`;
}

export function isEventOrderPortalView(view: string | string[] | undefined | null): boolean {
  const value = Array.isArray(view) ? view[0] : view;
  return value === "event-order";
}
