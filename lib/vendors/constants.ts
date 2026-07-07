/**
 * Vendor reference data and display helpers (Sprint 14).
 */
import type { InquiryStatus, Vendor, VendorInput, VendorPreferenceLevel } from "@/lib/vendors/types";

export type Option = { value: string; label: string };

export const PREFERENCE_LEVELS: { value: VendorPreferenceLevel; label: string; description: string }[] = [
  { value: "featured",    label: "Featured",    description: "Highlighted at the top of couple recommendations" },
  { value: "preferred",   label: "Preferred",   description: "Vendors you actively recommend" },
  { value: "recommended", label: "Recommended", description: "Quality vendors in your directory" },
];

export const PRICING_TIERS: Option[] = [
  { value: "budget",   label: "$ — Budget-friendly" },
  { value: "mid_range", label: "$$ — Mid-range" },
  { value: "premium",  label: "$$$ — Premium" },
  { value: "luxury",   label: "$$$$ — Luxury" },
];

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

export const INQUIRY_STATUSES: { value: InquiryStatus; label: string; description: string }[] = [
  { value: "new",                    label: "New",                    description: "Just received, not yet reviewed" },
  { value: "contacted",              label: "Contacted",              description: "You've replied or reached out" },
  { value: "consultation_scheduled", label: "Consultation Scheduled", description: "Call or meeting on the calendar" },
  { value: "proposal_sent",          label: "Proposal Sent",          description: "Quote or proposal delivered" },
  { value: "booked",                 label: "Booked",                 description: "Confirmed booking" },
  { value: "declined",               label: "Declined",               description: "You declined this booking" },
  { value: "lost",                   label: "Lost",                   description: "Venue went another direction" },
];

export const ACTIVE_INQUIRY_STATUSES: InquiryStatus[] =
  ["new", "contacted", "consultation_scheduled", "proposal_sent"];

export const INQUIRY_STATUS_VARIANT: Record<InquiryStatus, "default" | "secondary" | "outline" | "destructive"> = {
  new:                    "default",
  contacted:              "secondary",
  consultation_scheduled: "secondary",
  proposal_sent:          "secondary",
  booked:                 "default",
  declined:               "destructive",
  lost:                   "outline",
};

export function createInitialVendorInput(source?: Vendor | null): VendorInput {
  return {
    businessName:    source?.businessName ?? "",
    category:        source?.category ?? "",
    contactName:     source?.contactName ?? "",
    email:           source?.email ?? "",
    phone:           source?.phone ?? "",
    websiteUrl:      source?.websiteUrl ?? "",
    instagramUrl:    source?.instagramUrl ?? "",
    facebookUrl:     source?.facebookUrl ?? "",
    pinterestUrl:    source?.pinterestUrl ?? "",
    tiktokUrl:       source?.tiktokUrl ?? "",
    isPreferred:     source?.isPreferred ?? false,
    preferenceLevel: source?.preferenceLevel ?? "recommended",
    description:     source?.description ?? "",
    logoUrl:         source?.logoUrl ?? "",
    pricingTier:     source?.pricingTier ?? "",
    notes:           source?.notes ?? "",
  };
}
