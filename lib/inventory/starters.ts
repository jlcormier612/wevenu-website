/**
 * Hello to Cheers — Starter Inventory Catalog + Inventory Templates.
 *
 * Catalog = what the venue may provide (examples, quantityAvailable = 0, no prices).
 * Templates = what they typically use for a wedding type (structure only: qty 1, no prices).
 * Working Inventory = event-specific quantities (entered by the venue later).
 */

import type { InventoryShape } from "@/lib/inventory/types";

export type InventoryCatalogStarterKey = "INV-CAT";

export type InventoryTemplateStarterKey = "INV-01" | "INV-02";

export type CatalogStarterItem = {
  name: string;
  /** 0 = venue has not configured how many they own — never invent stock counts. */
  quantityAvailable: 0;
  width: number | null;
  length: number | null;
  height: number | null;
  shape: InventoryShape | null;
  availableForFloorPlans: boolean;
};

export type CatalogStarterCategory = {
  key: string;
  name: string;
  items: CatalogStarterItem[];
};

const item = (
  name: string,
  opts?: Partial<Pick<CatalogStarterItem, "width" | "length" | "height" | "shape" | "availableForFloorPlans">>,
): CatalogStarterItem => ({
  name,
  quantityAvailable: 0,
  width: opts?.width ?? null,
  length: opts?.length ?? null,
  height: opts?.height ?? null,
  shape: opts?.shape ?? null,
  availableForFloorPlans: opts?.availableForFloorPlans ?? false,
});

/** ~45 approachable starter catalog items — examples, not claims of ownership. */
export const INVENTORY_CATALOG_STARTER_CATEGORIES: readonly CatalogStarterCategory[] = [
  {
    key: "INV-CAT-tables",
    name: "Tables",
    items: [
      item('60" Round Table', { width: 60, length: 60, shape: "round", availableForFloorPlans: true }),
      item('72" Round Table', { width: 72, length: 72, shape: "round", availableForFloorPlans: true }),
      item("6' Banquet Table", { width: 72, length: 30, shape: "rectangular", availableForFloorPlans: true }),
      item("8' Banquet Table", { width: 96, length: 30, shape: "rectangular", availableForFloorPlans: true }),
      item("Cocktail Table", { width: 30, length: 30, shape: "cocktail", availableForFloorPlans: true }),
      item("Sweetheart Table", { width: 48, length: 24, shape: "rectangular", availableForFloorPlans: true }),
      item("Head Table", { width: 96, length: 30, shape: "rectangular", availableForFloorPlans: true }),
      item("Cake Table", { width: 60, length: 40, shape: "rectangular", availableForFloorPlans: true }),
      item("Gift / Card Table", { width: 72, length: 30, shape: "rectangular", availableForFloorPlans: true }),
      item("Registration / Welcome Table", { width: 72, length: 24, shape: "rectangular", availableForFloorPlans: true }),
    ],
  },
  {
    key: "INV-CAT-chairs",
    name: "Chairs",
    items: [
      item("Folding Chair", { width: 18, length: 18, shape: "square", availableForFloorPlans: true }),
      item("Banquet Chair", { width: 18, length: 20, shape: "square", availableForFloorPlans: true }),
      item("Chiavari Chair", { width: 16, length: 16, shape: "square", availableForFloorPlans: true }),
      item("Cross-Back Chair", { width: 18, length: 18, shape: "square", availableForFloorPlans: true }),
      item("Ceremony Chair", { width: 18, length: 18, shape: "square", availableForFloorPlans: true }),
      item("Bar Stool", { width: 16, length: 16, shape: "round", availableForFloorPlans: true }),
    ],
  },
  {
    key: "INV-CAT-linens",
    name: "Linens",
    items: [
      item('90" Round Linen'),
      item('108" Round Linen'),
      item('120" Round Linen'),
      item("6' Banquet Linen"),
      item("8' Banquet Linen"),
      item("Cocktail Table Linen"),
      item("Napkin"),
    ],
  },
  {
    key: "INV-CAT-ceremony",
    name: "Ceremony",
    items: [
      item("Ceremony Arbor", { width: 80, length: 20, shape: "arbor", availableForFloorPlans: true }),
      item("Aisle Runner", { width: 40, length: 200, shape: "aisle", availableForFloorPlans: true }),
      item("Signing Table", { width: 48, length: 24, shape: "rectangular", availableForFloorPlans: true }),
      item("Signing Chairs", { width: 18, length: 18, shape: "square", availableForFloorPlans: true }),
      item("Reserved Seating Sign"),
    ],
  },
  {
    key: "INV-CAT-reception",
    name: "Reception",
    items: [
      item("Dance Floor", { width: 144, length: 144, shape: "dance_floor", availableForFloorPlans: true }),
      item("Bar", { width: 140, length: 50, shape: "bar", availableForFloorPlans: true }),
      item("Buffet Table", { width: 96, length: 30, shape: "buffet", availableForFloorPlans: true }),
      item("Dessert Table", { width: 72, length: 30, shape: "rectangular", availableForFloorPlans: true }),
      item("DJ / Band Table", { width: 96, length: 48, shape: "dj_booth", availableForFloorPlans: true }),
    ],
  },
  {
    key: "INV-CAT-tabletop",
    name: "Tabletop",
    items: [
      item("Dinner Plate"),
      item("Salad Plate"),
      item("Water Glass"),
      item("Wine Glass"),
      item("Champagne Glass"),
      item("Flatware Place Setting"),
    ],
  },
  {
    key: "INV-CAT-equipment",
    name: "Equipment",
    items: [
      item("Microphone"),
      item("Speaker"),
      item("Podium", { width: 24, length: 18, shape: "rectangular", availableForFloorPlans: true }),
      item("Projector"),
    ],
  },
  {
    key: "INV-CAT-signage",
    name: "Signage & Accessories",
    items: [
      item("Easel"),
      item("Welcome Sign Stand"),
      item("Table Number Stand"),
    ],
  },
  {
    key: "INV-CAT-amenities",
    name: "Venue Amenities",
    items: [
      item("Getting Ready Room"),
      item("Coat Rack"),
      item("High Chair"),
    ],
  },
] as const;

export type InventoryTemplateStarterItem = {
  name: string;
  category: string;
};

export type InventoryTemplateStarterMaster = {
  key: InventoryTemplateStarterKey;
  name: string;
  description: string;
  items: InventoryTemplateStarterItem[];
};

const CEREMONY_RECEPTION_ITEMS: InventoryTemplateStarterItem[] = [
  // Ceremony
  { name: "Ceremony Chair", category: "Ceremony" },
  { name: "Ceremony Arbor", category: "Ceremony" },
  { name: "Aisle Runner", category: "Ceremony" },
  { name: "Signing Table", category: "Ceremony" },
  { name: "Signing Chairs", category: "Ceremony" },
  { name: "Reserved Seating Sign", category: "Ceremony" },
  // Reception seating
  { name: '60" Round Table', category: "Tables" },
  { name: "8' Banquet Table", category: "Tables" },
  { name: "Chiavari Chair", category: "Chairs" },
  { name: "Head Table", category: "Tables" },
  { name: "Sweetheart Table", category: "Tables" },
  // Reception setup
  { name: "Cocktail Table", category: "Reception" },
  { name: "Dance Floor", category: "Reception" },
  { name: "Bar", category: "Reception" },
  { name: "DJ / Band Table", category: "Reception" },
  { name: "Cake Table", category: "Tables" },
  { name: "Gift / Card Table", category: "Tables" },
  { name: "Dessert Table", category: "Reception" },
  // Tabletop
  { name: "Dinner Plate", category: "Tabletop" },
  { name: "Salad Plate", category: "Tabletop" },
  { name: "Water Glass", category: "Tabletop" },
  { name: "Wine Glass", category: "Tabletop" },
  { name: "Champagne Glass", category: "Tabletop" },
  { name: "Flatware Place Setting", category: "Tabletop" },
  // Linens
  { name: '108" Round Linen', category: "Linens" },
  { name: "8' Banquet Linen", category: "Linens" },
  { name: "Cocktail Table Linen", category: "Linens" },
  { name: "Napkin", category: "Linens" },
  // Signage
  { name: "Easel", category: "Signage & Accessories" },
  { name: "Table Number Stand", category: "Signage & Accessories" },
  { name: "Welcome Sign Stand", category: "Signage & Accessories" },
  // Amenities
  { name: "Getting Ready Room", category: "Venue Amenities" },
  { name: "Coat Rack", category: "Venue Amenities" },
  { name: "High Chair", category: "Venue Amenities" },
];

const RECEPTION_ONLY_ITEMS: InventoryTemplateStarterItem[] = CEREMONY_RECEPTION_ITEMS.filter(
  (i) => i.category !== "Ceremony",
);

export const INVENTORY_TEMPLATE_STARTER_MASTERS: readonly InventoryTemplateStarterMaster[] = [
  {
    key: "INV-01",
    name: "Standard Wedding — Ceremony + Reception",
    description:
      "A starting inventory list for weddings with both a ceremony and reception. Customize it to match the items your venue provides.",
    items: CEREMONY_RECEPTION_ITEMS,
  },
  {
    key: "INV-02",
    name: "Standard Wedding — Reception Only",
    description:
      "A starting inventory list for weddings with a reception at your venue but no on-site ceremony.",
    items: RECEPTION_ONLY_ITEMS,
  },
] as const;

export function getInventoryTemplateStarterMaster(key: string): InventoryTemplateStarterMaster | undefined {
  return INVENTORY_TEMPLATE_STARTER_MASTERS.find((m) => m.key === key);
}

export function countCatalogStarterItems(): number {
  return INVENTORY_CATALOG_STARTER_CATEGORIES.reduce((n, c) => n + c.items.length, 0);
}
