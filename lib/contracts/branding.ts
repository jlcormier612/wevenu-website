/**
 * Contract presentation branding frozen at draft→sent (release), matching
 * Invoice's branding_snapshot pattern. Snapshot wins when present; contracts
 * without a snapshot keep live venue branding (no silent backfill).
 */
import type { Venue } from "@/lib/venue/types";

/** Fields the Contract sign page and Contract PDF actually consume. */
export type ContractBrandingSnapshot = {
  name: string;
  businessName: string | null;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  neutralColor: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
};

export function captureContractBrandingSnapshot(venue: Venue): ContractBrandingSnapshot {
  return {
    name: venue.name,
    businessName: venue.businessName,
    logoUrl: venue.logoUrl,
    primaryColor: venue.primaryColor,
    secondaryColor: venue.secondaryColor,
    accentColor: venue.accentColor,
    neutralColor: venue.neutralColor,
    email: venue.email,
    phone: venue.phone,
    website: venue.website,
    addressLine1: venue.addressLine1,
    addressLine2: venue.addressLine2,
  };
}

/**
 * Prefer frozen snapshot fields when present; otherwise live venue.
 * Used by the sign page and PDF generator — never invents defaults beyond
 * what the caller already applied for missing live venue data.
 */
export function resolveContractBrandPresentation(
  snapshot: ContractBrandingSnapshot | null | undefined,
  venue: {
    name?: string | null;
    businessName?: string | null;
    logoUrl?: string | null;
    primaryColor?: string | null;
    secondaryColor?: string | null;
    accentColor?: string | null;
    neutralColor?: string | null;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
  } | null | undefined,
): ContractBrandingSnapshot | null {
  if (snapshot) return snapshot;
  if (!venue) return null;
  return {
    name: venue.name ?? "",
    businessName: venue.businessName ?? null,
    logoUrl: venue.logoUrl ?? null,
    primaryColor: venue.primaryColor ?? "#5D6F5D",
    secondaryColor: venue.secondaryColor ?? "#4F5F4F",
    accentColor: venue.accentColor ?? "#B8AEA1",
    neutralColor: venue.neutralColor ?? "#F7F5F1",
    email: venue.email ?? null,
    phone: venue.phone ?? null,
    website: venue.website ?? null,
    addressLine1: venue.addressLine1 ?? null,
    addressLine2: venue.addressLine2 ?? null,
  };
}
