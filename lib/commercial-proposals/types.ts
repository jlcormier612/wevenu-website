import type { PackageOfferRole } from "@/lib/packages/eligibility";

export type CommercialProposalStatus =
  | "draft"
  | "sent"
  | "selected"
  | "approved"
  | "superseded"
  | "withdrawn";

export type ProposalOptionItem = {
  description: string;
  quantity: number;
  unit: string | null;
};

export type CommercialProposalOption = {
  id: string;
  proposalId: string;
  venueId: string;
  sourcePackageId: string | null;
  offerRole: PackageOfferRole;
  name: string;
  description: string | null;
  unitPrice: number;
  includedItems: ProposalOptionItem[];
  sortOrder: number;
  frozenAt: string | null;
  createdAt: string;
};

export type CommercialProposalChoice = {
  id: string;
  proposalId: string;
  optionId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  name: string;
  offerRole: PackageOfferRole;
};

export type CommercialProposal = {
  id: string;
  venueId: string;
  leadId: string | null;
  clientId: string | null;
  eventId: string | null;
  status: CommercialProposalStatus;
  version: number;
  acceptToken: string | null;
  offerMessage: string | null;
  depositAmount: number;
  offeredAt: string | null;
  selectedAt: string | null;
  approvedAt: string | null;
  selectionId: string | null;
  eligibilityContext: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  options: CommercialProposalOption[];
  choices: CommercialProposalChoice[];
};

export type ProposalOptionDraft = {
  packageId: string;
  offerRole: PackageOfferRole;
};

export type CreateProposalInput = {
  leadId?: string;
  clientId?: string;
  eventId?: string;
  options: ProposalOptionDraft[];
  depositAmount?: number;
  message?: string;
  eligibilityContext?: {
    eventType?: string | null;
    guestCount?: number | null;
    spaceId?: string | null;
  };
};

export type ClientChoiceInput = {
  optionId: string;
  quantity?: number;
};

export function calculateProposalTotal(
  options: Pick<CommercialProposalOption, "id" | "unitPrice">[],
  choices: ClientChoiceInput[],
): number {
  let total = 0;
  for (const c of choices) {
    const opt = options.find((o) => o.id === c.optionId);
    if (!opt) continue;
    const qty = c.quantity != null && c.quantity > 0 ? c.quantity : 1;
    total += Math.round((opt.unitPrice * qty + Number.EPSILON) * 100) / 100;
  }
  return Math.round((total + Number.EPSILON) * 100) / 100;
}

export function validateClientChoices(
  options: Pick<CommercialProposalOption, "id" | "offerRole">[],
  choices: ClientChoiceInput[],
): { ok: true } | { ok: false; message: string } {
  if (!choices.length) return { ok: false, message: "Choose a package to continue." };
  const primaryIds = new Set(options.filter((o) => o.offerRole === "primary").map((o) => o.id));
  const addonIds = new Set(options.filter((o) => o.offerRole === "addon").map((o) => o.id));
  let primaryCount = 0;
  for (const c of choices) {
    const opt = options.find((o) => o.id === c.optionId);
    if (!opt) return { ok: false, message: "That option is not on this proposal." };
    const qty = c.quantity != null ? c.quantity : 1;
    if (!(qty > 0)) return { ok: false, message: "Quantity must be greater than zero." };
    if (primaryIds.has(c.optionId)) {
      primaryCount += 1;
      if (qty !== 1) return { ok: false, message: "Choose exactly one package." };
    } else if (!addonIds.has(c.optionId)) {
      return { ok: false, message: "That option is not on this proposal." };
    }
  }
  if (primaryCount !== 1) {
    return { ok: false, message: "Choose exactly one package." };
  }
  return { ok: true };
}
