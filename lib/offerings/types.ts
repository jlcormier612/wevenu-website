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
  /**
   * Denormalized primary major (first of parentOfferingIds). Prefer parentOfferingIds.
   * Null when the offering is top-level (major choice or standalone).
   */
  parentOfferingId: string | null;
  /** Zero or more top-level majors this offering belongs under (M:N). */
  parentOfferingIds: string[];
  name: string;
  description: string | null;
  unit: string | null;
  defaultUnitPrice: number | null;
  inventoryItemId: string | null;
  /** Dedicated Offering photo URL; null = none. */
  imageUrl: string | null;
  isArchived: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type OfferingWithCategory = Offering & {
  categoryName: string | null;
  /** Comma-separated major names for display. */
  parentOfferingName?: string | null;
  parentOfferingNames?: string[];
  /** Linked Inventory item photo when inventoryItemId is set (fallback source). */
  inventoryImageUrl?: string | null;
};

export type OfferingInput = {
  name: string;
  categoryId: string | null;
  /** Majors this item belongs under. Empty = top-level major/standalone. */
  parentOfferingIds: string[];
  description: string;
  unit: string;
  defaultUnitPrice: string;
  inventoryItemId: string | null;
};

export type OfferingActionResult = { ok: true } | { ok: false; message?: string };
export type CreateOfferingResult = { ok: true; offeringId: string } | { ok: false; message?: string };
export type CreateOfferingCategoryResult = { ok: true; categoryId: string } | { ok: false; message?: string };
