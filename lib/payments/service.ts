/**
 * Payments application service. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { triggerAutoComplete } from "@/lib/playbooks/service";
import * as repo from "@/lib/payments/repository";
import {
  computeTotalPaid,
  deriveScheduleStatus,
  SCHEDULE_PRESETS,
} from "@/lib/payments/constants";
import type {
  AddLineItemResult,
  CreateScheduleResult,
  LineItemInput,
  MarkPaidInput,
  PaymentActionResult,
  PaymentLineItem,
  PaymentScheduleSummary,
  PaymentScheduleWithDetails,
  ScheduleInput,
} from "@/lib/payments/types";
import {
  validateLineItemInput,
  validateMarkPaidInput,
  validateScheduleInput,
} from "@/lib/payments/validation";
import { getCurrentVenue, getCurrentUserRole } from "@/lib/venue/service";
import { recordEngagementEvent } from "@/lib/activation/service";

async function withVenue<T>(
  fn: (supabase: Awaited<ReturnType<typeof createClient>>, venueId: string) => Promise<T>,
): Promise<T | PaymentActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expired." };
  return fn(supabase, venue.id);
}

// ---- read -------------------------------------------------------------------

export async function getPaymentSchedules(): Promise<PaymentScheduleSummary[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  // Auto-mark overdue items
  await supabase.rpc("mark_overdue_payments", { p_venue_id: venue.id });
  const [schedules, allItems] = await Promise.all([
    repo.getSchedules(supabase, venue.id),
    repo.getAllLineItems(supabase, venue.id),
  ]);
  return schedules.map((s) => {
    const items = allItems.filter((i) => i.scheduleId === s.id);
    const totalPaid = computeTotalPaid(items);
    const overdueCount = items.filter((i) => i.status === "overdue").length;
    return {
      ...s,
      totalPaid,
      balance: s.totalAmount - totalPaid,
      overdueCount,
      pendingCount: items.filter((i) => i.status === "pending").length,
      scheduleStatus: deriveScheduleStatus(items),
    } as PaymentScheduleSummary;
  });
}

export async function getPaymentSchedule(id: string): Promise<PaymentScheduleWithDetails | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  // Auto-mark overdue items for this venue before fetching
  await supabase.rpc("mark_overdue_payments", { p_venue_id: venue.id });
  return repo.getSchedule(supabase, venue.id, id);
}

/** Upcoming payments across all schedules — for the dashboard. */
export async function getUpcomingPayments(daysAhead = 30): Promise<PaymentLineItem[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const future = new Date(Date.now() + daysAhead * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("payment_line_items")
    .select("*")
    .eq("venue_id", venue.id)
    .eq("status", "pending")
    .gte("due_date", today)
    .lte("due_date", future)
    .order("due_date", { ascending: true })
    .limit(10);
  if (error) return [];
  // We'll map them — this is for the dashboard so we need the light type
  return (data as Parameters<typeof repo.getAllLineItems>[0] extends any ? any[] : never[]).map((r: any) => ({
    id: r.id, venueId: r.venue_id, scheduleId: r.schedule_id, label: r.label,
    amount: Number(r.amount), dueDate: r.due_date, status: r.status as PaymentLineItem["status"],
    paidAt: r.paid_at, paidAmount: r.paid_amount != null ? Number(r.paid_amount) : null,
    paymentMethod: r.payment_method, referenceNumber: r.reference_number,
    notes: r.notes, sortOrder: r.sort_order,
    refundedAmount: r.refunded_amount != null ? Number(r.refunded_amount) : 0,
    refundedAt: r.refunded_at ?? null, refundReason: r.refund_reason ?? null,
    createdAt: r.created_at, updatedAt: r.updated_at,
  }));
}

// ---- create -----------------------------------------------------------------

export async function createPaymentSchedule(
  input: ScheduleInput,
  presetId?: string,
  eventDate?: string | null,
  invoiceId?: string | null,
): Promise<CreateScheduleResult> {
  const errors = validateScheduleInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const totalAmount = parseFloat(input.totalAmount.replace(/[$,]/g, ""));
  const result = await withVenue(async (supabase, venueId) => {
    const scheduleId = await repo.insertSchedule(supabase, venueId, {
      title: input.title, clientId: input.clientId, eventId: input.eventId,
      totalAmount, notes: input.notes, invoiceId: invoiceId ?? null,
    });
    // Apply preset line items
    if (presetId && presetId !== "custom") {
      const preset = SCHEDULE_PRESETS.find((p) => p.id === presetId);
      if (preset) {
        for (let i = 0; i < preset.items.length; i++) {
          const pi = preset.items[i];
          const amt = Math.round((totalAmount * pi.pctOfTotal) / 100 * 100) / 100;
          let dueDate: string | undefined;
          if (eventDate && pi.offsetDaysFromEvent != null) {
            const d = new Date(eventDate + "T12:00:00");
            d.setDate(d.getDate() + pi.offsetDaysFromEvent);
            dueDate = d.toISOString().slice(0, 10);
          }
          await repo.insertLineItem(supabase, venueId, scheduleId, {
            label: pi.label, amount: String(amt), dueDate: dueDate ?? "",
          }, i);
        }
      }
    }
    await repo.insertPaymentActivity(supabase, venueId, scheduleId, "schedule_created", "Payment schedule created");
    return { ok: true, scheduleId } as CreateScheduleResult;
  });
  return result as CreateScheduleResult;
}

// ---- line items -------------------------------------------------------------

export async function addLineItem(scheduleId: string, input: LineItemInput): Promise<AddLineItemResult> {
  const errors = validateLineItemInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors, message: errors.label };
  const result = await withVenue(async (supabase, venueId) => {
    // Get current max sort_order
    const { data } = await supabase.from("payment_line_items")
      .select("sort_order").eq("schedule_id", scheduleId).order("sort_order", { ascending: false }).limit(1);
    const nextSort = ((data?.[0] as any)?.sort_order ?? -1) + 1;
    const item = await repo.insertLineItem(supabase, venueId, scheduleId, input, nextSort);
    return { ok: true, item } as AddLineItemResult;
  });
  return result as AddLineItemResult;
}

export async function updateLineItem_(itemId: string, scheduleId: string, input: LineItemInput): Promise<PaymentActionResult> {
  const errors = validateLineItemInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const result = await withVenue(async (supabase, venueId) => {
    await repo.updateLineItem(supabase, venueId, itemId, input);
    return { ok: true } as PaymentActionResult;
  });
  return result as PaymentActionResult;
}

export async function markLineItemPaid(itemId: string, scheduleId: string, input: MarkPaidInput): Promise<PaymentActionResult> {
  const errors = validateMarkPaidInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const result = await withVenue(async (supabase, venueId) => {
    await repo.markItemPaid(supabase, venueId, itemId, input);
    const amount = parseFloat(input.paidAmount.replace(/[$,]/g, ""));
    await repo.insertPaymentActivity(supabase, venueId, scheduleId, "payment_received",
      `Payment received: $${amount.toLocaleString()}`,
      input.paymentMethod ? `Via ${input.paymentMethod}` : undefined);

    // Reconcile the linked invoice's balance_due, if any
    const { data: sch } = await supabase.from("payment_schedules")
      .select("invoice_id, event_id").eq("id", scheduleId).maybeSingle<{ invoice_id: string | null; event_id: string | null }>();
    if (sch?.invoice_id) {
      await repo.reconcileInvoiceBalance(supabase, venueId, sch.invoice_id);
    }
    // "Pay final payment"-style Planning tasks complete themselves the
    // moment a payment actually lands — this was previously only logged as
    // an activity string, never wired (Vendor Management — Next Iteration,
    // 2026-07-10, item 4).
    if (sch?.event_id) {
      await triggerAutoComplete(supabase, venueId, sch.event_id, "payment_received", "payment_line_item", itemId);
    }

    void recordEngagementEvent({
      venueId,
      eventType: "invoice.paid",
      actorType: "venue_user",
      entityType: "payment_line_item",
      entityId:  itemId,
    });

    return { ok: true } as PaymentActionResult;
  });
  return result as PaymentActionResult;
}

/**
 * TR-M3: refunds are Owner-only per docs/permissions-model-proposal.md — the
 * one financial action with real potential for abuse and no operational
 * urgency the way "mark paid" has. Manager gets every other financial
 * mutation but not this one.
 */
export async function refundLineItem_(
  itemId: string,
  scheduleId: string,
  refundAmount: number,
  reason?: string,
): Promise<PaymentActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const role = await getCurrentUserRole();
    if (role !== "owner") {
      return { ok: false, message: "Only the venue Owner can issue a refund." } as PaymentActionResult;
    }
    const outcome = await repo.refundLineItem(supabase, venueId, itemId, refundAmount, reason);
    if (!outcome.ok) return { ok: false, message: outcome.message } as PaymentActionResult;

    await repo.insertPaymentActivity(supabase, venueId, scheduleId,
      outcome.newStatus === "refunded" ? "refunded" : "partially_refunded",
      `Refund issued: $${refundAmount.toLocaleString()}`,
      reason?.trim() || undefined);

    const { data: sch } = await supabase.from("payment_schedules")
      .select("invoice_id").eq("id", scheduleId).maybeSingle<{ invoice_id: string | null }>();
    if (sch?.invoice_id) {
      await repo.reconcileInvoiceBalance(supabase, venueId, sch.invoice_id);
    }

    return { ok: true } as PaymentActionResult;
  });
  return result as PaymentActionResult;
}

export async function cancelLineItem_(itemId: string): Promise<PaymentActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.cancelLineItem(supabase, venueId, itemId);
    return { ok: true } as PaymentActionResult;
  });
  return result as PaymentActionResult;
}

export async function deleteLineItem_(itemId: string): Promise<PaymentActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const role = await getCurrentUserRole();
    if (role !== "owner" && role !== "manager") {
      return { ok: false, message: "Only an Owner or Manager can delete a payment line item." } as PaymentActionResult;
    }
    const outcome = await repo.deleteLineItem(supabase, venueId, itemId);
    if (!outcome.ok) return { ok: false, message: outcome.message } as PaymentActionResult;
    return { ok: true } as PaymentActionResult;
  });
  return result as PaymentActionResult;
}

export async function deletePaymentSchedule(scheduleId: string): Promise<PaymentActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const role = await getCurrentUserRole();
    if (role !== "owner" && role !== "manager") {
      return { ok: false, message: "Only an Owner or Manager can delete a payment schedule." } as PaymentActionResult;
    }
    const outcome = await repo.deleteSchedule(supabase, venueId, scheduleId);
    if (!outcome.ok) return { ok: false, message: outcome.message } as PaymentActionResult;
    return { ok: true } as PaymentActionResult;
  });
  return result as PaymentActionResult;
}
