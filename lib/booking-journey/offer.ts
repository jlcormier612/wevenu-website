import { createAdminClient } from "@/integrations/supabase/admin";
import { publicAppOrigin } from "@/lib/env";
import type { ProposalBrand } from "@/lib/booking-journey/proposal-view";

type OfferView = {
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

/**
 * Public offer lookup — no venue session. Uses service_role against
 * SECURITY DEFINER RPCs that scope by accept_token only.
 */
export async function getOfferByToken(
  token: string,
  client: OfferRpcClient = adminOfferClient(),
): Promise<OfferView | null> {
  const { data, error } = await client.rpc("get_commercial_selection_by_accept_token", {
    p_token: token,
  });
  if (error) return null;
  const offer = mapOfferRpcData(data);
  if (!offer) return null;

  // Production RPC returns venueId; test fixtures omit it (no admin enrich).
  const row = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  const venueId = row && typeof row.venueId === "string" ? row.venueId : null;
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
    // Offer still renders with ProposalArtifact defaults when enrich fails.
  }

  return offer;
}

/**
 * Public offer accept — no venue session. Same service_role + token RPC model.
 */
export async function acceptOfferByToken(
  token: string,
  client: OfferRpcClient = adminOfferClient(),
): Promise<{ ok: true; alreadyAccepted?: boolean } | { ok: false; message: string }> {
  const { data, error } = await client.rpc("accept_commercial_selection", { p_token: token });
  return mapAcceptRpcResult(data, error);
}

export function offerAcceptUrl(token: string): string {
  return `${publicAppOrigin()}/offer/${token}`;
}
