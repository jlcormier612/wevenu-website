/**
 * Vendor reference data and display helpers (Sprint 14).
 */
import type { Vendor, VendorInput } from "@/lib/vendors/types";

export type Option = { value: string; label: string };

export const VENDOR_CATEGORIES: Option[] = [
  { value: "caterer",        label: "Caterer" },
  { value: "photographer",   label: "Photographer" },
  { value: "videographer",   label: "Videographer" },
  { value: "florist",        label: "Florist" },
  { value: "music",          label: "DJ / Band / Music" },
  { value: "hair_makeup",    label: "Hair & Makeup" },
  { value: "officiant",      label: "Officiant" },
  { value: "transportation", label: "Transportation" },
  { value: "cake",           label: "Cake & Desserts" },
  { value: "decor",          label: "Decor & Lighting" },
  { value: "photo_booth",    label: "Photo Booth" },
  { value: "other",          label: "Other" },
];

export function vendorCategoryLabel(value: string | null): string {
  if (!value) return "";
  return VENDOR_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export function formatTime(hhmm: string | null | undefined): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":");
  return new Date(0, 0, 0, Number(h), Number(m)).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function createInitialVendorInput(source?: Vendor | null): VendorInput {
  return {
    name: source?.name ?? "",
    category: source?.category ?? "",
    contactName: source?.contactName ?? "",
    email: source?.email ?? "",
    phone: source?.phone ?? "",
    website: source?.website ?? "",
    instagramUrl: source?.instagramUrl ?? "",
    facebookUrl: source?.facebookUrl ?? "",
    pinterestUrl: source?.pinterestUrl ?? "",
    tiktokUrl: source?.tiktokUrl ?? "",
    isPreferred: source?.isPreferred ?? false,
    notes: source?.notes ?? "",
  };
}
