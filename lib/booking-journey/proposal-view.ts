/**
 * Couple-facing proposal view. Built from the frozen commercial selection
 * (plus an optional unsent message). Never live-binds catalog packages.
 */
import { remainingAmount } from "@/lib/commercial-selections/constants";
import type { CommercialSelection } from "@/lib/commercial-selections/types";

/**
 * Live venue brand for the proposal renderer.
 * Colors and logo are read from the venue at view time. They are not stored on the proposal.
 */
export type ProposalBrand = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  neutralColor: string;
  /** Current venues.logo_url. Null when the venue has no logo. */
  logoUrl: string | null;
};

const BRAND_FALLBACK = {
  primaryColor: "#5D6F5D",
  secondaryColor: "#4F5F4F",
  accentColor: "#B8AEA1",
  neutralColor: "#F7F5F1",
} as const;

/** Live brand from venue columns. Empty logo becomes null so the renderer omits the image. */
export function proposalBrand(input: {
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  neutralColor?: string | null;
  logoUrl?: string | null;
}): ProposalBrand {
  const logo = input.logoUrl?.trim() ?? "";
  return {
    primaryColor: input.primaryColor || BRAND_FALLBACK.primaryColor,
    secondaryColor: input.secondaryColor || BRAND_FALLBACK.secondaryColor,
    accentColor: input.accentColor || BRAND_FALLBACK.accentColor,
    neutralColor: input.neutralColor || BRAND_FALLBACK.neutralColor,
    logoUrl: logo || null,
  };
}

export type ProposalView = {
  name: string;
  venueName?: string | null;
  totalAmount: number;
  depositAmount: number;
  remainingAmount: number;
  includedItems: { description: string; quantity: number; unit: string | null }[];
  status: string;
  offerMessage: string | null;
  brand?: ProposalBrand | null;
};

export function proposalViewFromSelection(
  selection: Pick<
    CommercialSelection,
    "name" | "totalAmount" | "depositAmount" | "includedItems" | "status" | "offerMessage"
  >,
  draftMessage?: string,
  brand?: ProposalBrand | null,
): ProposalView {
  const fromDraft = draftMessage !== undefined ? draftMessage.trim() || null : undefined;
  return {
    name: selection.name,
    totalAmount: selection.totalAmount,
    depositAmount: selection.depositAmount,
    remainingAmount: remainingAmount(selection.totalAmount, selection.depositAmount),
    includedItems: selection.includedItems,
    status: selection.status,
    offerMessage: fromDraft !== undefined ? fromDraft : selection.offerMessage,
    brand: brand ?? null,
  };
}
