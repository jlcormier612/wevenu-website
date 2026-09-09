/**
 * Hello to Cheers — Starter Offerings catalog.
 * Examples only; no invented prices. Venues set their own prices.
 */

export type OfferingStarterCategory = {
  key: string;
  name: string;
  items: { name: string; unit?: string; description?: string }[];
};

export const OFFERING_STARTER_CATEGORIES: readonly OfferingStarterCategory[] = [
  {
    key: "OFF-CAT-catering",
    name: "Catering",
    items: [
      { name: "Chicken Marsala", unit: "guest" },
      { name: "Vegetarian entrée", unit: "guest" },
      { name: "Caesar salad", unit: "guest" },
      { name: "Cheesecake", unit: "guest" },
    ],
  },
  {
    key: "OFF-CAT-bar",
    name: "Bar",
    items: [
      { name: "Premium open bar", unit: "event", description: "Beer, wine, and well spirits" },
      { name: "Champagne toast", unit: "guest" },
      { name: "Signature cocktail", unit: "guest" },
    ],
  },
  {
    key: "OFF-CAT-services",
    name: "Services",
    items: [
      { name: "Bartender service", unit: "staff" },
      { name: "Day-of coordination", unit: "event" },
    ],
  },
  {
    key: "OFF-CAT-rentals",
    name: "Rentals",
    items: [
      { name: "Chiavari chair rental", unit: "each" },
      { name: "Ivory linen rental", unit: "each" },
    ],
  },
] as const;
