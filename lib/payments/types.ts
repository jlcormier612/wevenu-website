/**
 * Payments domain types (Sprint 16 — Payments Foundation).
 */

export type PaymentItemStatus = "pending" | "overdue" | "paid" | "cancelled" | "partially_refunded" | "refunded";

export type PaymentSchedule = {
  id: string;
  venueId: string;
  clientId: string | null;
  eventId: string | null;
  invoiceId: string | null;   // links schedule to its source invoice (Sprint 22)
  title: string;
  totalAmount: number;
  currency: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // Embedded from joins
  clientName: string | null;
  eventDate: string | null;
  /**
   * Booking Financial Architecture Phase 3c — the Invoice total a
   * coordinator last explicitly reviewed and accepted via "Keep Existing
   * Schedule" or "Collect Remaining Balance Manually." Null = never
   * acknowledged. A Payment Plan's total never moves on its own; this only
   * ever remembers what a human already looked at and decided was fine.
   */
  acknowledgedInvoiceTotal: number | null;
};

/** Booking Financial Architecture Phase 3c — never derived from a timestamp; a direct comparison of the schedule's own total against its Invoice's current total. */
export type PaymentPlanReviewStatus = "current" | "needs_review";

export type PaymentLineItem = {
  id: string;
  venueId: string;
  scheduleId: string;
  label: string;
  amount: number;
  dueDate: string | null;
  status: PaymentItemStatus;
  paidAt: string | null;
  paidAmount: number | null;
  paymentMethod: string | null;
  referenceNumber: string | null;
  notes: string | null;
  sortOrder: number;
  refundedAmount: number;
  refundedAt: string | null;
  refundReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PaymentActivity = {
  id: string;
  venueId: string;
  scheduleId: string;
  type: string;
  title: string;
  description: string | null;
  createdAt: string;
};

/** Schedule with all related data for the detail page. */
export type PaymentScheduleWithDetails = PaymentSchedule & {
  lineItems: PaymentLineItem[];
  activities: PaymentActivity[];
  // Computed
  totalPaid: number;
  balance: number;
  overdueCount: number;
  scheduleStatus: "complete" | "attention" | "on_track" | "no_payments";
};

/** Summary for the list page (line items aggregated). */
export type PaymentScheduleSummary = PaymentSchedule & {
  totalPaid: number;
  balance: number;
  overdueCount: number;
  pendingCount: number;
  scheduleStatus: "complete" | "attention" | "on_track" | "no_payments";
};

/**
 * Booking Financial Architecture Phase 1 (docs/booking-financial-architecture-
 * roadmap.md): a Payment Schedule is always linked to an Invoice — its total
 * is derived server-side from invoice.total, never typed here. `clientId`/
 * `eventId` are likewise derived from the invoice, not re-entered.
 */
export type ScheduleInput = {
  title: string;
  invoiceId: string;
  notes: string;
};

export type LineItemInput = {
  label: string;
  amount: string;
  dueDate: string;
};

export type MarkPaidInput = {
  paidAmount: string;
  paymentMethod: string;
  referenceNumber: string;
  paidDate: string;
  notes: string;
};

export type PaymentErrors = Record<string, string>;

export type PaymentActionResult =
  | { ok: true }
  | { ok: false; errors?: PaymentErrors; message?: string };

export type CreateScheduleResult =
  | { ok: true; scheduleId: string }
  | { ok: false; errors?: PaymentErrors; message?: string };

export type CreateRetainerResult =
  | { ok: true; invoiceId: string; scheduleId: string }
  | { ok: false; message: string };

export type AddLineItemResult =
  | { ok: true; item: PaymentLineItem }
  | { ok: false; errors?: PaymentErrors; message?: string };

/** Booking Financial Architecture Phase 3c — the four resolution paths for a Needs Review Payment Plan. Always a human choice; the system never picks one. */
export type ScheduleReviewAction = "keep" | "regenerate" | "add_installment" | "collect_manually";
