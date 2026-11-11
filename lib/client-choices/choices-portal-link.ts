/**
 * Selection-request links must open the couple portal Choices form.
 * Financial tokens always render Invoice & Payment Plan and ignore #choices.
 */

export type PortalSessionAccess = {
  accessToken: string;
  accessLevel: string;
};

/** Couple or planning sessions can render the selection form. Financial cannot. */
export function pickChoicesPortalSession<T extends PortalSessionAccess>(
  sessions: readonly T[],
): T | null {
  return (
    sessions.find((s) => s.accessLevel === "couple" && s.accessToken)
    ?? sessions.find((s) => s.accessLevel === "planning" && s.accessToken)
    ?? null
  );
}

/** Query survives email click-tracking that drops URL fragments. Hash still deep-links. */
export function choicesReviewUrl(origin: string, accessToken: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/p/${encodeURIComponent(accessToken)}?view=choices#choices`;
}

export function isChoicesPortalView(view: string | string[] | undefined | null): boolean {
  const value = Array.isArray(view) ? view[0] : view;
  return value === "choices";
}
