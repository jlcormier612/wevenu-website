/**
 * Load authoritative portal payloads and build LuvAskPortalContext.
 * Reuses the same RPCs as /api/portal/payments and /api/portal/documents.
 */

import { createAdminClient } from "@/integrations/supabase/admin";
import { createClient } from "@/integrations/supabase/server";
import { buildLuvAskPortalContext } from "@/lib/luv/portal-context/build";
import type { LuvAskPortalContext } from "@/lib/luv/portal-context/types";
import type { PortalInvoiceRef } from "@/lib/portal/payment-obligations";
import {
  selectCanonicalPaymentSchedules,
  type PortalPaymentScheduleLike,
} from "@/lib/portal/payment-schedules";

type DocRow = {
  id?: string;
  name?: string | null;
  docType?: string | null;
  status?: string | null;
  signedAt?: string | null;
  signToken?: string | null;
};

async function loadOnlinePaymentsReady(token: string): Promise<boolean | null> {
  try {
    const admin = createAdminClient();
    const { data: session } = await admin
      .from("client_portal_sessions")
      .select("venue_id")
      .eq("access_token", token)
      .maybeSingle<{ venue_id: string }>();
    if (!session?.venue_id) return null;
    const { data: venue } = await admin
      .from("venues")
      .select("stripe_account_id, stripe_onboarding_status, stripe_charges_enabled")
      .eq("id", session.venue_id)
      .maybeSingle<{
        stripe_account_id: string | null;
        stripe_onboarding_status: string | null;
        stripe_charges_enabled: boolean | null;
      }>();
    if (!venue) return null;
    return Boolean(
      venue.stripe_account_id &&
        venue.stripe_onboarding_status === "connected" &&
        venue.stripe_charges_enabled === true,
    );
  } catch {
    return null;
  }
}

async function loadContractSignersById(
  contractIds: string[],
): Promise<Record<string, { signerType: "venue" | "client"; signedAt: string | null; isRequired: boolean }[]>> {
  const out: Record<string, { signerType: "venue" | "client"; signedAt: string | null; isRequired: boolean }[]> = {};
  if (contractIds.length === 0) return out;
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("contract_signers")
    .select("contract_id, signer_type, signed_at, is_required")
    .in("contract_id", contractIds);

  for (const r of (rows ?? []) as {
    contract_id: string;
    signer_type: string;
    signed_at: string | null;
    is_required: boolean;
  }[]) {
    const list = out[r.contract_id] ?? [];
    list.push({
      signerType: r.signer_type === "venue" ? "venue" : "client",
      signedAt: r.signed_at,
      isRequired: r.is_required,
    });
    out[r.contract_id] = list;
  }
  return out;
}

export async function loadLuvAskPortalContext(token: string): Promise<LuvAskPortalContext> {
  const supabase = await createClient();

  const [paymentsRes, documentsRes, onlinePaymentsReady] = await Promise.all([
    supabase.rpc("get_portal_payments", { p_token: token }),
    supabase.rpc("get_couple_documents", { p_token: token }),
    loadOnlinePaymentsReady(token),
  ]);

  const payPayload = (paymentsRes.data ?? {}) as {
    schedules?: PortalPaymentScheduleLike[];
    invoices?: PortalInvoiceRef[];
    error?: string;
  };
  const schedules = selectCanonicalPaymentSchedules(payPayload.schedules ?? []);
  const invoices = payPayload.invoices ?? [];

  const docPayload = (documentsRes.data ?? {}) as { documents?: DocRow[] };
  const documents = docPayload.documents ?? [];

  const contractIds = documents
    .filter((d) => d.docType === "contract" && d.id)
    .map((d) => d.id!) as string[];
  const contractSignersById = await loadContractSignersById(contractIds);

  return buildLuvAskPortalContext({
    schedules,
    invoices,
    onlinePaymentsReady,
    documents,
    contractSignersById,
  });
}
