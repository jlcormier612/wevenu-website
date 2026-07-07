/**
 * Vendor packages service. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getVendorUser } from "@/lib/vendor-auth/service";
import type { VendorActionResult, VendorPackage, VendorPackageInput } from "@/lib/vendors/types";

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

function mapPackage(d: Record<string, unknown>): VendorPackage {
  return {
    id:          d.id as string,
    vendorId:    d.vendor_id as string,
    name:        d.name as string,
    description: (d.description as string | null) ?? null,
    price:       (d.price as number | null) ?? null,
    priceType:   d.price_type as VendorPackage["priceType"],
    isActive:    Boolean(d.is_active),
    sortOrder:   (d.sort_order as number) ?? 0,
    createdAt:   d.created_at as string,
    updatedAt:   d.updated_at as string,
  };
}

export async function getVendorPackages(vendorId: string): Promise<VendorPackage[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("vendor_packages")
    .select("*")
    .eq("vendor_id", vendorId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  return (data ?? []).map(mapPackage);
}

export async function createVendorPackage(input: VendorPackageInput): Promise<VendorActionResult & { packageId?: string }> {
  if (!input.name.trim()) return { ok: false, message: "Package name is required." };
  const result = await withVendor(async (supabase, vendorId) => {
    const price = input.price.trim() ? parseFloat(input.price) : null;
    const { data, error } = await supabase
      .from("vendor_packages")
      .insert({
        vendor_id:   vendorId,
        name:        input.name.trim(),
        description: input.description || null,
        price:       isNaN(price!) ? null : price,
        price_type:  input.priceType,
        is_active:   input.isActive,
      })
      .select("id")
      .single();
    if (error) return { ok: false, message: error.message } as VendorActionResult;
    return { ok: true, packageId: data.id } as VendorActionResult & { packageId: string };
  });
  return result as VendorActionResult & { packageId?: string };
}

export async function updateVendorPackage(packageId: string, input: VendorPackageInput): Promise<VendorActionResult> {
  if (!input.name.trim()) return { ok: false, message: "Package name is required." };
  const result = await withVendor(async (supabase) => {
    const price = input.price.trim() ? parseFloat(input.price) : null;
    const { error } = await supabase
      .from("vendor_packages")
      .update({
        name:        input.name.trim(),
        description: input.description || null,
        price:       isNaN(price!) ? null : price,
        price_type:  input.priceType,
        is_active:   input.isActive,
      })
      .eq("id", packageId);
    if (error) return { ok: false, message: error.message } as VendorActionResult;
    return { ok: true } as VendorActionResult;
  });
  return result as VendorActionResult;
}

export async function deleteVendorPackage(packageId: string): Promise<VendorActionResult> {
  const result = await withVendor(async (supabase) => {
    const { error } = await supabase.from("vendor_packages").delete().eq("id", packageId);
    if (error) return { ok: false, message: error.message } as VendorActionResult;
    return { ok: true } as VendorActionResult;
  });
  return result as VendorActionResult;
}

export async function toggleVendorPackage(packageId: string, isActive: boolean): Promise<VendorActionResult> {
  const result = await withVendor(async (supabase) => {
    const { error } = await supabase
      .from("vendor_packages")
      .update({ is_active: isActive })
      .eq("id", packageId);
    if (error) return { ok: false, message: error.message } as VendorActionResult;
    return { ok: true } as VendorActionResult;
  });
  return result as VendorActionResult;
}
