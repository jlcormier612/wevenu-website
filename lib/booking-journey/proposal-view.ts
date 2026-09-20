/**
 * Couple-facing proposal view. Built from the frozen commercial selection
 * (plus an optional unsent message). Never live-binds catalog packages.
 */
import { remainingAmount } from "@/lib/commercial-selections/constants";
import type { CommercialSelection } from "@/lib/commercial-selections/types";

export type ProposalView = {
  name: string;
  venueName?: string | null;
  totalAmount: number;
  depositAmount: number;
  remainingAmount: number;
  includedItems: { description: string; quantity: number; unit: string | null }[];
  status: string;
  offerMessage: string | null;
};

export function proposalViewFromSelection(
  selection: Pick<
    CommercialSelection,
    "name" | "totalAmount" | "depositAmount" | "includedItems" | "status" | "offerMessage"
  >,
  draftMessage?: string,
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
  };
}
