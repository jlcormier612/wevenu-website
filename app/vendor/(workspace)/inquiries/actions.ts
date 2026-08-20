"use server";
import { revalidatePath } from "next/cache";
import {
  createVendorInquiry,
  updateVendorInquiry,
  updateInquiryStatus,
  deleteVendorInquiry,
} from "@/lib/vendor-inquiries/service";
import type { VendorActionResult, VendorInquiryInput, InquiryStatus } from "@/lib/vendors/types";

export async function createVendorInquiryAction(
  input: VendorInquiryInput,
): Promise<VendorActionResult> {
  const result = await createVendorInquiry(input);
  if (result.ok) revalidatePath("/vendor/inquiries");
  return result;
}

export async function updateVendorInquiryAction(
  id:    string,
  input: Partial<VendorInquiryInput & { status: InquiryStatus; followUpAt: string }>,
): Promise<VendorActionResult> {
  const result = await updateVendorInquiry(id, input);
  if (result.ok) {
    revalidatePath("/vendor/inquiries");
    revalidatePath(`/vendor/inquiries/${id}`);
  }
  return result;
}

export async function updateInquiryStatusAction(
  id:     string,
  status: InquiryStatus,
): Promise<VendorActionResult> {
  const result = await updateInquiryStatus(id, status);
  if (result.ok) {
    revalidatePath("/vendor/inquiries");
    revalidatePath(`/vendor/inquiries/${id}`);
    revalidatePath("/vendor/dashboard");
  }
  return result;
}

export async function deleteVendorInquiryAction(id: string): Promise<VendorActionResult> {
  const result = await deleteVendorInquiry(id);
  if (result.ok) {
    revalidatePath("/vendor/inquiries");
    revalidatePath("/vendor/dashboard");
  }
  return result;
}
