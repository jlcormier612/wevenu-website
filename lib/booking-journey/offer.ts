import { createAdminClient } from "@/integrations/supabase/admin";
import { publicAppOrigin } from "@/lib/env";

type OfferView = {
  id: string;
  name: string;
  totalAmount: number;
  depositAmount: number;
  remainingAmount: number;
  includedItems: { description: string; quantity: number; unit: string | null }[];
  status: string;
  offerMessage: string | null;
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
    return { ok: false, message: "Could not accept this offer." };
  }
  const row = data as Record<string, unknown>;
  if (row.ok === false) {
    const err = String(row.error ?? "error");
    if (err === "invalid_token") return { ok: false, message: "This offer link is not valid." };
    if (err === "not_offered") return { ok: false, message: "This offer cannot be accepted." };
    return { ok: false, message: "Could not accept this offer." };
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
  return mapOfferRpcData(data);
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
