/**
 * Event Order — Booking Financial Architecture, Phase 2.
 *
 * The single governed record of what a booked Event will actually receive,
 * per docs/booking-financial-architecture-event-order-model.md and
 * docs/booking-financial-architecture-sections-and-catalogs.md. Belongs to
 * exactly one Event (never a Client — a Client with two Events gets two
 * Event Orders). Nothing downstream (Invoice, Floor Plan) consumes this
 * yet — that's Phase 3 and Phase 4.
 */

export type EventOrderStatus = "open" | "finalized";

/** Derived, never stored — see lib/event-orders/constants.ts::eventOrderDisplayStatus. */
export type EventOrderDisplayStatus = "open" | "finalized" | "amended";

export type EventOrderLineProvenance = "package" | "inventory" | "custom";

export type EventOrder = {
  id: string;
  venueId: string;
  eventId: string;
  status: EventOrderStatus;
  revision: number;
  finalizedAt: string | null;
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
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
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
  /**
   * Sum of this Event Order's own lines only — not the same figure as a
   * future linked Invoice's total (Phase 3), which will also include tax
   * and billing-only adjustments Event Order deliberately never owns (see
   * the "delivered vs. money-mechanics" litmus test in the Sections doc).
   */
  total: number;
};

export type AddCustomLineInput = {
  description: string;
  quantity: string;
  unitPrice: string;
  sectionId: string | null;
};

export type AddInventoryLineInput = {
  inventoryItemId: string;
  description: string;
  quantity: string;
  unitPrice: string;
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
