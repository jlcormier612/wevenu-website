import type { PackageInput } from "@/lib/packages/types";

export const PACKAGE_CATEGORIES = [
  "Venue", "Catering", "Bar & Beverage", "Floral & Décor",
  "Photography", "Videography", "Entertainment", "Lighting & AV",
  "Transportation", "Hair & Beauty", "Officiants", "Rentals", "Other",
];

export const EMPTY_PACKAGE_INPUT: PackageInput = {
  name: "", description: "", basePrice: "", category: "", isActive: true,
};

export function formatPrice(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents);
}
