import { createAdminClient } from "@/integrations/supabase/admin";
import { publicAppOrigin } from "@/lib/env";
import type { ProposalBrand } from "@/lib/booking-journey/proposal-view";
import {
  approveProposalByToken,
  getProposalByToken,
  selectProposalByToken,
} from "@/lib/commercial-proposals/service";
import type { ClientChoiceInput } from "@/lib/commercial-proposals/types";
import { calculateProposalTotal } from "@/lib/commercial-proposals/types";

export type OfferOptionView = {
  id: string;
  offerRole: "primary" | "addon";
  name: string;
  description: string | null;
  unitPrice: number;
  includedItems: { description: string; quantity: number; unit: string | null }[];
  sortOrder: number;
};

export type OfferChoiceView = {
  optionId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  name: string;
  offerRole: "primary" | "addon";
};

/** Multi-option proposal (L1) or legacy single-package selection. */
export type OfferView = {
  kind: "proposal" | "legacy_selection";
  id: string;
  name: string;
  venueName: string | null;
  totalAmount: number;
  depositAmount: number;
  remainingAmount: number;
  includedItems: { description: string; quantity: number; unit: string | null }[];
  status: string;
  offerMessage: string | null;
  brand?: ProposalBrand | null;
  options?: OfferOptionView[];
  choices?: OfferChoiceView[];
  selectedAt?: string | null;
  approvedAt?: string | null;
  selectionId?: string | null;
};

/** Minimal RPC surface so tests can exercise get/accept without venue auth. */
export type OfferRpcClient = {
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message?: string } | null }>;
};

function adminOfferClient(): OfferRpcClient {
  return createAdminClient();
}

export function mapOfferRpcData(data: unknown): OfferView | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  if (row.error) return null;
  return {
    kind: "legacy_selection",
    id: String(row.id),
    name: String(row.name),
    venueName: row.venueName ? String(row.venueName) : null,
    totalAmount: Number(row.totalAmount),
    depositAmount: Number(row.depositAmount),
    remainingAmount: Number(row.remainingAmount),
    includedItems: Array.isArray(row.includedItems)
      ? (row.includedItems as OfferView["includedItems"])
      : [],
    status: String(row.status),
    offerMessage: row.offerMessage ? String(row.offerMessage) : null,
  };
}

export function mapAcceptRpcResult(
  data: unknown,
  error: { message?: string } | null,
): { ok: true; alreadyAccepted?: boolean } | { ok: false; message: string } {
  if (error || !data || typeof data !== "object") {
    return { ok: false, message: "Could not accept this proposal." };
  }
  const row = data as Record<string, unknown>;
  if (row.ok === false) {
    const err = String(row.error ?? "error");
    if (err === "invalid_token") return { ok: false, message: "This proposal link is not valid." };
    if (err === "not_offered") return { ok: false, message: "This proposal cannot be accepted." };
    return { ok: false, message: "Could not accept this proposal." };
  }
  return { ok: true, alreadyAccepted: row.alreadyAccepted === true };
}

function mapProposalTokenData(row: Record<string, unknown>): OfferView | null {
  if (row.error) return null;
  const options: OfferOptionView[] = Array.isArray(row.options)
    ? (row.options as Record<string, unknown>[]).map((o) => ({
        id: String(o.id),
        offerRole: o.offerRole === "addon" ? "addon" : "primary",
        name: String(o.name),
        description: o.description ? String(o.description) : null,
        unitPrice: Number(o.unitPrice),
        includedItems: Array.isArray(o.includedItems)
          ? (o.includedItems as OfferOptionView["includedItems"])
          : [],
        sortOrder: Number(o.sortOrder ?? 0),
      }))
    : [];
  const choices: OfferChoiceView[] = Array.isArray(row.choices)
    ? (row.choices as Record<string, unknown>[]).map((c) => ({
        optionId: String(c.optionId),
        quantity: Number(c.quantity),
        unitPrice: Number(c.unitPrice),
        lineTotal: Number(c.lineTotal),
        name: String(c.name),
        offerRole: c.offerRole === "addon" ? "addon" : "primary",
      }))
    : [];
  const totalFromChoices =
    choices.length > 0
      ? choices.reduce((s, c) => s + c.lineTotal, 0)
      : 0;
  const deposit = Number(row.depositAmount ?? 0);
  const primaryName =
    choices.find((c) => c.offerRole === "primary")?.name ??
    options.find((o) => o.offerRole === "primary")?.name ??
    "Your proposal";

  return {
    kind: "proposal",
    id: String(row.id),
    name: primaryName,
    venueName: row.venueName ? String(row.venueName) : null,
    totalAmount: totalFromChoices,
    depositAmount: deposit,
    remainingAmount: Math.max(0, totalFromChoices - deposit),
    includedItems: choices.map((c) => ({
      description: c.name,
      quantity: c.quantity,
      unit: c.offerRole === "addon" ? "add-on" : "package",
    })),
    status: String(row.status),
    offerMessage: row.offerMessage ? String(row.offerMessage) : null,
    options,
    choices,
    selectedAt: row.selectedAt ? String(row.selectedAt) : null,
    approvedAt: row.approvedAt ? String(row.approvedAt) : null,
    selectionId: row.selectionId ? String(row.selectionId) : null,
  };
}

async function enrichBrand(venueId: string | null, offer: OfferView): Promise<OfferView> {
  if (!venueId) return offer;
  try {
    const admin = createAdminClient();
    const { data: venue } = await admin
      .from("venues")
      .select("primary_color, secondary_color, accent_color, neutral_color")
      .eq("id", venueId)
      .maybeSingle<{
        primary_color: string | null;
        secondary_color: string | null;
        accent_color: string | null;
        neutral_color: string | null;
      }>();
    if (venue) {
      offer.brand = {
        primaryColor: venue.primary_color || "#5D6F5D",
        secondaryColor: venue.secondary_color || "#4F5F4F",
        accentColor: venue.accent_color || "#B8AEA1",
        neutralColor: venue.neutral_color || "#F7F5F1",
      };
    }
  } catch {
    /* defaults */
  }
  return offer;
}

/**
 * Public offer lookup — tries L1 multi-option proposal first, then legacy selection.
 */
export async function getOfferByToken(
  token: string,
  client: OfferRpcClient = adminOfferClient(),
): Promise<OfferView | null> {
  try {
    const proposalRow = await getProposalByToken(token);
    if (proposalRow && typeof proposalRow === "object" && !("error" in proposalRow && proposalRow.error)) {
      const mapped = mapProposalTokenData(proposalRow as Record<string, unknown>);
      if (mapped) {
        const venueId =
          typeof (proposalRow as Record<string, unknown>).venueId === "string"
            ? String((proposalRow as Record<string, unknown>).venueId)
            : null;
        return enrichBrand(venueId, mapped);
      }
    }
  } catch {
    /* fall through to legacy selection token */
  }

  const { data, error } = await client.rpc("get_commercial_selection_by_accept_token", {
    p_token: token,
  });
  if (error) return null;
  const offer = mapOfferRpcData(data);
  if (!offer) return null;

  const row = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  const venueId = row && typeof row.venueId === "string" ? row.venueId : null;
  return enrichBrand(venueId, offer);
}

/** Legacy binary accept — still used for old selection links. */
export async function acceptOfferByToken(
  token: string,
  client: OfferRpcClient = adminOfferClient(),
): Promise<{ ok: true; alreadyAccepted?: boolean } | { ok: false; message: string }> {
  try {
    const proposal = await getProposalByToken(token);
    if (proposal && !(proposal as { error?: unknown }).error) {
      return approveProposalByToken(token);
    }
  } catch {
    /* legacy path */
  }
  const { data, error } = await client.rpc("accept_commercial_selection", { p_token: token });
  return mapAcceptRpcResult(data, error);
}

export async function selectOfferChoicesByToken(
  token: string,
  choices: ClientChoiceInput[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  return selectProposalByToken(token, choices);
}

export async function approveOfferChoicesByToken(
  token: string,
  choices: ClientChoiceInput[],
): Promise<
  | { ok: true; selectionId?: string; alreadyApproved?: boolean }
  | { ok: false; message: string }
> {
  return approveProposalByToken(token, choices);
}

export function offerAcceptUrl(token: string): string {
  return `${publicAppOrigin()}/offer/${token}`;
}

export { calculateProposalTotal };
