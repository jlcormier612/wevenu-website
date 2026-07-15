export type InvoiceStatus = "draft" | "sent" | "paid" | "void";

export type InvoiceLineItemType =
  | "package" | "addon" | "inventory" | "discount" | "fee" | "tax" | "deposit" | "item";

export type InvoiceLineItem = {
  id: string;
  invoiceId: string;
  venueId: string;
  packageId: string | null;
  type: InvoiceLineItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;  // quantity × unitPrice
  sortOrder: number;
  createdAt: string;
  /**
   * Booking Financial Architecture Phase 3a. Non-null means this line
   * traces back to an Event Order line. While the Invoice is still `draft`
   * and linked to an Event Order, lines with this set are NOT real
   * invoice_line_items rows at all — they're computed live from Event
   * Order on every read (docs/booking-financial-architecture-phase3-trust-
   * design.md's "a Draft Invoice is a projection, not a record") and reuse
   * the Event Order line's own id. They become real, frozen, stored rows
   * only once Phase 3b's freeze-on-send exists. Either way: never editable
   * or removable from the Invoice side — that decision belongs to Event
   * Order.
   */
  eventOrderLineId: string | null;
};

export type Invoice = {
  id: string;
  venueId: string;
  clientId: string | null;
  eventId: string | null;
  invoiceNumber: string;
  status: InvoiceStatus;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  balanceDue: number;
  notes: string | null;
  dueDate: string | null;
  issuedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Embedded
  clientName: string | null;
  eventDate: string | null;
  eventName: string | null;
  /** Booking Financial Architecture Phase 3a. Null = not linked; a Draft invoice with this set is a live projection of that Event Order. */
  eventOrderId: string | null;
  /** Booking Financial Architecture Phase 3b — which Event Order line-state a coordinator last reviewed and dismissed drift for. Null = never dismissed. */
  eventOrderDismissedFingerprint: string | null;
  /** Booking Financial Architecture Phase 3c — set only on a newly-created amended invoice, pointing back at the invoice it amends. The original's own status is never touched by this. */
  amendsInvoiceId: string | null;
  /** Booking Financial Architecture Phase 3c — Event Order's revision number at the moment this invoice was frozen (sent). Null until sent; permanent afterward, independent of Event Order's current revision. */
  eventOrderRevisionAtFreeze: number | null;
  /** Booking Financial Architecture Phase 3c — the reverse of amendsInvoiceId: set when some OTHER invoice amends this one. Computed at read time, not stored; lets the original show "an amended invoice exists" without its own status ever changing. */
  amendedByInvoiceId: string | null;
  amendedByInvoiceNumber: string | null;
};

export type InvoiceWithLineItems = Invoice & {
  lineItems: InvoiceLineItem[];
};

export type InvoiceActivity = {
  id: string;
  venueId: string;
  invoiceId: string;
  type: string;
  title: string;
  description: string | null;
  createdAt: string;
};

export type InvoiceLineItemInput = {
  type: InvoiceLineItemType;
  description: string;
  quantity: string;
  unitPrice: string;
  packageId: string;
  discountType?: "fixed" | "percent";
  discountValue?: string;  // the raw % or fixed amount entered
};

export type InvoiceInput = {
  clientId: string;
  eventId: string;
  notes: string;
  dueDate: string;
  /** Booking Financial Architecture Phase 3a — set when creating an invoice directly from an Event Order. */
  eventOrderId?: string;
  /** Booking Financial Architecture Phase 3c — set only when this invoice is being created to amend another. */
  amendsInvoiceId?: string;
};

export type InvoiceErrors = Record<string, string>;

export type InvoiceActionResult =
  | { ok: true }
  | { ok: false; errors?: InvoiceErrors; message?: string };

export type CreateInvoiceResult =
  | { ok: true; invoiceId: string }
  | { ok: false; errors?: InvoiceErrors; message?: string };

export type AddLineItemResult =
  | { ok: true; item: InvoiceLineItem }
  | { ok: false; errors?: InvoiceErrors; message?: string };

/**
 * Booking Financial Architecture Phase 3b — the observe/explain half of the
 * trust migration. Computed by diffing an Invoice's frozen, Event-Order-
 * sourced lines against Event Order's current lines directly; never a
 * revision counter or timestamp proxy. "Changed" (quantity/description) and
 * "Price Changes" are deliberately separate buckets per the calm-banner
 * design — a line with both a quantity and a price change appears in both,
 * since hiding either fact would work against "immediate comprehension."
 */
export type EventOrderLineSnapshot = { description: string; quantity: number; unitPrice: number; amount: number };
export type EventOrderLineChange = {
  description: string;
  fromQuantity: number; toQuantity: number;
  fromDescription: string; toDescription: string;
};
export type EventOrderPriceChange = { description: string; fromUnitPrice: number; toUnitPrice: number };

export type EventOrderDrift = {
  added: EventOrderLineSnapshot[];
  removed: EventOrderLineSnapshot[];
  changed: EventOrderLineChange[];
  priceChanged: EventOrderPriceChange[];
  /** e.g. "2 items added, 1 price changed (Catering)" — built once, ready to render at a glance. */
  summary: string;
};
