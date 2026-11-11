/**
 * Package composition for Import Data / Migration Center.
 * HTC package_items are description/quantity/unit lines — not inventory FKs.
 */
import type { PackageItemInput } from "@/lib/packages/types";

/**
 * Parse included-items cell.
 * Supported forms (semicolon-separated entries):
 * - `Description|qty|unit`
 * - `Description|qty`
 * - `Description` (qty defaults to 1)
 */
export function parsePackageIncludedItems(raw: string):
  | { ok: true; items: PackageItemInput[] }
  | { ok: false; message: string } {
  const t = raw.trim();
  if (!t) return { ok: true, items: [] };

  const items: PackageItemInput[] = [];
  for (const part of t.split(";")) {
    const entry = part.trim();
    if (!entry) continue;
    const bits = entry.split("|").map((s) => s.trim());
    const description = bits[0] ?? "";
    if (!description) {
      return { ok: false, message: `Included item is missing a description (entry "${entry}").` };
    }
    const quantity = bits[1] && bits[1].length > 0 ? bits[1] : "1";
    if (!/^\d+(\.\d+)?$/.test(quantity)) {
      return { ok: false, message: `Included item quantity must be a number (got "${quantity}" in "${entry}").` };
    }
    const unit = bits[2] ?? "";
    items.push({ description, quantity, unit });
  }
  return { ok: true, items };
}

export function formatPackageIncludedItems(items: PackageItemInput[]): string {
  return items
    .map((i) => {
      const q = i.quantity.trim() || "1";
      const u = i.unit.trim();
      return u ? `${i.description.trim()}|${q}|${u}` : `${i.description.trim()}|${q}`;
    })
    .join("; ");
}
