/**
 * Document-driven Inventory share mode.
 * Venue owners send with one action; selectable Additional items on the
 * document determine whether the couple gets review-only or selection UX.
 */

export type InventoryShareMode = "view" | "select";

export function resolveInventoryShareMode(
  items: ReadonlyArray<{ clientSelectable?: boolean | null }>,
): InventoryShareMode {
  return items.some((i) => Boolean(i.clientSelectable)) ? "select" : "view";
}

/** Actionable copy when a caller forces select mode with no valid choices. */
export const INVENTORY_SELECT_SHARE_CONFIG_ERROR =
  "This inventory is set up for couple choices, but no Additional item is marked Select. On each Additional row you want them to choose, click Select — then Share inventory again.";
