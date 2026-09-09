/**
 * Event Order — Booking Financial Architecture + Offerings delivery model.
 */

export type EventOrderStatus = "open" | "finalized";

/** Derived, never stored — see lib/event-orders/constants.ts::eventOrderDisplayStatus. */
export type EventOrderDisplayStatus = "open" | "finalized" | "amended";

export type EventOrderLineProvenance = "package" | "inventory" | "custom" | "offering";

export type EventOrder = {
  id: string;
  venueId: string;
  eventId: string;
  status: EventOrderStatus;
  revision: number;
  finalizedAt: string | null;
  /** Set by share; never cleared by reopen. Client sees last share snapshot until re-share. */
  sharedAt: string | null;
  templateId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EventOrderSection = {
  id: string;
  eventOrderId: string;
  venueId: string;
  name: string;
  sortOrder: number;
  floorPlanId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EventOrderLine = {
  id: string;
  eventOrderId: string;
  venueId: string;
  sectionId: string | null;
  provenance: EventOrderLineProvenance;
  packageId: string | null;
  inventoryItemId: string | null;
  offeringId: string | null;
  description: string;
  descriptionDetail: string | null;
  quantity: number;
  unit: string | null;
  /** Null = unpriced delivery line. */
  unitPrice: number | null;
  amount: number;
  isIncluded: boolean;
  notes: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type EventOrderActivity = {
  id: string;
  eventOrderId: string;
  venueId: string;
  type: string;
  title: string;
  description: string | null;
  createdAt: string;
};

export type EventOrderWithDetails = EventOrder & {
  sections: EventOrderSection[];
  lines: EventOrderLine[];
  activities: EventOrderActivity[];
  /** Informational delivery subtotal — not amount owed. */
  total: number;
};

export type AddCustomLineInput = {
  description: string;
  quantity: string;
  unitPrice: string;
  sectionId: string | null;
  unit?: string;
  isIncluded?: boolean;
  notes?: string;
  descriptionDetail?: string;
};

export type AddInventoryLineInput = {
  inventoryItemId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  sectionId: string | null;
  unit?: string;
  isIncluded?: boolean;
  notes?: string;
};

export type AddOfferingLineInput = {
  offeringId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  sectionId: string | null;
  unit?: string;
  isIncluded?: boolean;
  notes?: string;
  descriptionDetail?: string;
  inventoryItemId?: string | null;
};

export type UpdateLineInput = {
  description: string;
  quantity: string;
  unitPrice: string;
  unit?: string;
  isIncluded: boolean;
  notes?: string;
  descriptionDetail?: string;
  sectionId: string | null;
};

export type EventOrderErrors = Record<string, string>;

export type EventOrderActionResult =
  | { ok: true }
  | { ok: false; errors?: EventOrderErrors; message?: string };

export type EnsureEventOrderResult =
  | { ok: true; eventOrderId: string }
  | { ok: false; message: string };

export type AddLineResult =
  | { ok: true; line: EventOrderLine }
  | { ok: false; errors?: EventOrderErrors; message?: string };

export type AddSectionResult =
  | { ok: true; section: EventOrderSection }
  | { ok: false; message: string };

/** Frozen client-visible share payload. */
export type EventOrderSharePayload = {
  sections: { id: string; name: string; sortOrder: number }[];
  lines: {
    id: string;
    sectionId: string | null;
    description: string;
    quantity: number;
    unit: string | null;
    unitPrice: number | null;
    amount: number;
    isIncluded: boolean;
    notes: string | null;
    sortOrder: number;
  }[];
};
