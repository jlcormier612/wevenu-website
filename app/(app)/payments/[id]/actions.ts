"use server";

import { revalidatePath } from "next/cache";

import {
  addLineItem,
  cancelLineItem_,
  deleteLineItem_,
  markLineItemPaid,
  updateLineItem_,
} from "@/lib/payments/service";
import type {
  AddLineItemResult,
  LineItemInput,
  MarkPaidInput,
  PaymentActionResult,
} from "@/lib/payments/types";

function revalidate(scheduleId: string) {
  revalidatePath(`/payments/${scheduleId}`);
  revalidatePath("/payments");
}

export async function addLineItemAction(scheduleId: string, input: LineItemInput): Promise<AddLineItemResult> {
  const result = await addLineItem(scheduleId, input);
  if (result.ok) revalidate(scheduleId);
  return result;
}

export async function updateLineItemAction(itemId: string, scheduleId: string, input: LineItemInput): Promise<PaymentActionResult> {
  const result = await updateLineItem_(itemId, scheduleId, input);
  if (result.ok) revalidate(scheduleId);
  return result;
}

export async function markPaidAction(itemId: string, scheduleId: string, input: MarkPaidInput): Promise<PaymentActionResult> {
  const result = await markLineItemPaid(itemId, scheduleId, input);
  if (result.ok) {
    revalidate(scheduleId);
    // Payment received = commitment milestone — find lead and refresh
    void (async () => {
      try {
        const { createClient } = await import("@/integrations/supabase/server");
        const supabase = await createClient();
        const { data: sched } = await supabase.from("payment_schedules")
          .select("client_id").eq("id", scheduleId).maybeSingle<{ client_id: string | null }>();
        if (!sched?.client_id) return;
        const { data: client } = await supabase.from("clients")
          .select("lead_id").eq("id", sched.client_id).maybeSingle<{ lead_id: string | null }>();
        if (!client?.lead_id) return;
        const { refreshLeadScore } = await import("@/lib/leads/scores");
        await refreshLeadScore(client.lead_id);
      } catch { /* non-blocking */ }
    })();
  }
  return result;
}

export async function cancelItemAction(itemId: string, scheduleId: string): Promise<PaymentActionResult> {
  const result = await cancelLineItem_(itemId);
  if (result.ok) revalidate(scheduleId);
  return result;
}

export async function deleteItemAction(itemId: string, scheduleId: string): Promise<PaymentActionResult> {
  const result = await deleteLineItem_(itemId);
  if (result.ok) revalidate(scheduleId);
  return result;
}
