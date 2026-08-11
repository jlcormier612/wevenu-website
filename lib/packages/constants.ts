import type { PackageInput } from "@/lib/packages/types";

export const PACKAGE_CATEGORIES = [
  "Venue", "Catering", "Bar & Beverage", "Floral & Décor",
  "Photography", "Videography", "Entertainment", "Lighting & AV",
  "Transportation", "Hair & Beauty", "Officiants", "Rentals", "Other",
];

export const EMPTY_PACKAGE_INPUT: PackageInput = {
  name: "", description: "", basePrice: "", category: "", isActive: true,
};

/** Display catalog price. Null/empty must never render as $0.00. */
export function formatPrice(amount: number | null | undefined, currency = "USD"): string {
  if (amount == null || Number.isNaN(amount)) return "Set your price";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

/** Parse UI price input. Empty → null (unpriced). Invalid → NaN for caller validation. */
export function parsePackagePriceInput(raw: string): number | null {
  const t = raw.trim().replace(/[$,]/g, "");
  if (!t) return null;
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : Number.NaN;
}
