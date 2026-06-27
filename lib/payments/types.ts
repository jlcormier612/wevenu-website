/**
 * Payments domain types (Sprint 16 — Payments Foundation).
 */

export type PaymentItemStatus = "pending" | "overdue" | "paid" | "cancelled";

export type PaymentSchedule = {
  id: string;
  venueId: string;
  clientId: string | null;
  eventId: string | null;
  title: string;
  totalAmount: number;
  currency: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // Embedded from joins
  clientName: string | null;
  eventDate: string | null;
};

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

export type ScheduleInput = {
  title: string;
  clientId: string;
  eventId: string;
  totalAmount: string;
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

export type AddLineItemResult =
  | { ok: true; item: PaymentLineItem }
  | { ok: false; errors?: PaymentErrors; message?: string };
