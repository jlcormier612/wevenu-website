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

export async function getOfferByToken(token: string): Promise<OfferView | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("get_commercial_selection_by_accept_token", {
    p_token: token,
  });
  if (error || !data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  if (row.error) return null;
  return {
    id: String(row.id),
    name: String(row.name),
    totalAmount: Number(row.totalAmount),
    depositAmount: Number(row.depositAmount),
    remainingAmount: Number(row.remainingAmount),
    includedItems: Array.isArray(row.includedItems) ? (row.includedItems as OfferView["includedItems"]) : [],
    status: String(row.status),
    offerMessage: row.offerMessage ? String(row.offerMessage) : null,
  };
}

export async function acceptOfferByToken(
  token: string,
): Promise<{ ok: true; alreadyAccepted?: boolean } | { ok: false; message: string }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("accept_commercial_selection", { p_token: token });
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

export function offerAcceptUrl(token: string): string {
  return `${publicAppOrigin()}/offer/${token}`;
}
