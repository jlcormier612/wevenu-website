/**
 * Offerings — reusable things a venue can provide to an event/client.
 * Distinct from Library Inventory (physical stock / floor-plan catalog).
 */

export type OfferingCategory = {
  id: string;
  venueId: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type Offering = {
  id: string;
  venueId: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  unit: string | null;
  defaultUnitPrice: number | null;
  inventoryItemId: string | null;
  isArchived: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type OfferingWithCategory = Offering & {
  categoryName: string | null;
};

export type OfferingInput = {
  name: string;
  categoryId: string | null;
  description: string;
  unit: string;
  defaultUnitPrice: string;
  inventoryItemId: string | null;
};

export type OfferingActionResult = { ok: true } | { ok: false; message?: string };
export type CreateOfferingResult = { ok: true; offeringId: string } | { ok: false; message?: string };
export type CreateOfferingCategoryResult = { ok: true; categoryId: string } | { ok: false; message?: string };
