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
  if (result.ok) revalidate(scheduleId);
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
