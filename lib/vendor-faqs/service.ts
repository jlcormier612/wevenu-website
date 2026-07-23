/**
 * Vendor FAQs service. Server-only. Mirrors lib/vendor-packages/service.ts
 * exactly — same shape of vendor-owned content, same withVendor() guard.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getVendorUser } from "@/lib/vendor-auth/service";
import type { VendorActionResult, VendorFaq, VendorFaqInput } from "@/lib/vendors/types";

async function withVendor<T>(
  fn: (supabase: Awaited<ReturnType<typeof createClient>>, vendorId: string) => Promise<T>,
): Promise<T | VendorActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const vendorUser = await getVendorUser();
  if (!vendorUser) return { ok: false, message: "No vendor account found." };
  if (!["owner", "manager"].includes(vendorUser.role)) return { ok: false, message: "Insufficient permissions." };
  const supabase = await createClient();
  return fn(supabase, vendorUser.vendorId);
}

function mapFaq(d: Record<string, unknown>): VendorFaq {
  return {
    id:         d.id as string,
    vendorId:   d.vendor_id as string,
    question:   d.question as string,
    answer:     d.answer as string,
    sortOrder:  (d.sort_order as number) ?? 0,
    createdAt:  d.created_at as string,
    updatedAt:  d.updated_at as string,
  };
}

export async function getVendorFaqs(vendorId: string): Promise<VendorFaq[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("vendor_faqs")
    .select("*")
    .eq("vendor_id", vendorId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  return (data ?? []).map(mapFaq);
}

export async function createVendorFaq(input: VendorFaqInput): Promise<VendorActionResult & { faqId?: string }> {
  if (!input.question.trim() || !input.answer.trim()) return { ok: false, message: "Question and answer are both required." };
  const result = await withVendor(async (supabase, vendorId) => {
    const { data, error } = await supabase
      .from("vendor_faqs")
      .insert({ vendor_id: vendorId, question: input.question.trim(), answer: input.answer.trim() })
      .select("id")
      .single();
    if (error) return { ok: false, message: error.message } as VendorActionResult;
    return { ok: true, faqId: data.id } as VendorActionResult & { faqId: string };
  });
  return result as VendorActionResult & { faqId?: string };
}

export async function updateVendorFaq(faqId: string, input: VendorFaqInput): Promise<VendorActionResult> {
  if (!input.question.trim() || !input.answer.trim()) return { ok: false, message: "Question and answer are both required." };
  const result = await withVendor(async (supabase) => {
    const { error } = await supabase
      .from("vendor_faqs")
      .update({ question: input.question.trim(), answer: input.answer.trim() })
      .eq("id", faqId);
    if (error) return { ok: false, message: error.message } as VendorActionResult;
    return { ok: true } as VendorActionResult;
  });
  return result as VendorActionResult;
}

export async function deleteVendorFaq(faqId: string): Promise<VendorActionResult> {
  const result = await withVendor(async (supabase) => {
    const { error } = await supabase.from("vendor_faqs").delete().eq("id", faqId);
    if (error) return { ok: false, message: error.message } as VendorActionResult;
    return { ok: true } as VendorActionResult;
  });
  return result as VendorActionResult;
}
