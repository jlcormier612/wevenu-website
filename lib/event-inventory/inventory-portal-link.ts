/**
 * Inventory-share links must open the couple (or planning) portal Inventory tab.
 * Financial tokens always render Invoice & Payment Plan and ignore #inventory /
 * ?view=inventory — same class of defect Choices already guards against.
 */

export type PortalSessionAccess = {
  accessToken: string;
  accessLevel: string;
};

/** Couple or planning sessions can render inventory. Financial cannot. */
export function pickInventoryPortalSession<T extends PortalSessionAccess>(
  sessions: readonly T[],
): T | null {
  return (
    sessions.find((s) => s.accessLevel === "couple" && s.accessToken)
    ?? sessions.find((s) => s.accessLevel === "planning" && s.accessToken)
    ?? null
  );
}

/**
 * Query survives email click-tracking that drops URL fragments.
 * Hash still deep-links for in-app navigation.
 */
export function inventoryReviewUrl(origin: string, accessToken: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/p/${encodeURIComponent(accessToken)}?view=inventory#inventory`;
}

export function isInventoryPortalView(view: string | string[] | undefined | null): boolean {
  const value = Array.isArray(view) ? view[0] : view;
  return value === "inventory";
}
