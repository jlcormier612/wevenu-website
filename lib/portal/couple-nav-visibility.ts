/**
 * P2-D — Couple portal nav visibility (Documents-first).
 * Pure helpers — no DB writes. Deep links may still open sections when nav is hidden.
 */
import { isClientChoicesClientEditable } from "@/lib/client-choices/constants";

/** Inventory statuses the couple can still act on or must review. */
export const COUPLE_INVENTORY_NAV_STATUSES = [
  "shared",
  "submitted",
  "changes_requested",
  "confirmed",
] as const;

/**
 * Choices nav: only while the couple must act (editable request).
 * Submitted/finalized/draft-only do not keep a pending Choices tab.
 */
export function coupleChoicesNavVisible(
  choices: ReadonlyArray<{ status: string }> | null | undefined,
): boolean {
  if (!choices?.length) return false;
  return choices.some((c) => isClientChoicesClientEditable(c.status));
}

/**
 * Inventory nav: when a client-facing inventory collaboration exists.
 * Finalized-only / unshared → hide (operational complete or not started).
 */
export function coupleInventoryNavVisible(input: {
  hasInventory: boolean;
  status?: string | null;
}): boolean {
  if (!input.hasInventory) return false;
  const s = input.status ?? null;
  if (!s) return true; // API returned inventory payload without status — treat as visible
  if (s === "finalized") return false;
  return (COUPLE_INVENTORY_NAV_STATUSES as readonly string[]).includes(s);
}

/**
 * Event Order nav: only while a shared order still needs optional acceptance.
 * Discovery of the shared final order is Documents — not a permanent Order tab.
 * Deep link `#event-order` remains mountable when nav is hidden.
 */
export function coupleEventOrderNavVisible(input: {
  shared: boolean;
  clientAgreedAt?: string | null;
}): boolean {
  if (!input.shared) return false;
  return !input.clientAgreedAt;
}
