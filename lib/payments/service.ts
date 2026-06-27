/**
 * Payments application service. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
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
import { getCurrentVenue } from "@/lib/venue/service";

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
    notes: r.notes, sortOrder: r.sort_order, createdAt: r.created_at, updatedAt: r.updated_at,
  }));
}

// ---- create -----------------------------------------------------------------

export async function createPaymentSchedule(
  input: ScheduleInput,
  presetId?: string,
  eventDate?: string | null,
): Promise<CreateScheduleResult> {
  const errors = validateScheduleInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const totalAmount = parseFloat(input.totalAmount.replace(/[$,]/g, ""));
  const result = await withVenue(async (supabase, venueId) => {
    const scheduleId = await repo.insertSchedule(supabase, venueId, {
      title: input.title, clientId: input.clientId, eventId: input.eventId,
      totalAmount, notes: input.notes,
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
    await repo.deleteLineItem(supabase, venueId, itemId);
    return { ok: true } as PaymentActionResult;
  });
  return result as PaymentActionResult;
}

export async function deletePaymentSchedule(scheduleId: string): Promise<PaymentActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.deleteSchedule(supabase, venueId, scheduleId);
    return { ok: true } as PaymentActionResult;
  });
  return result as PaymentActionResult;
}
