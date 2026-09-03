/**
 * Share an externally executed agreement with the couple using the same
 * `is_couple_visible` publication flag native Contracts/Documents/Invoices
 * already use — never invents a parallel portal path or fake e-sign send.
 */

import type { createClient } from "@/integrations/supabase/server";
import * as repo from "@/lib/contracts/repository";
import * as documentsRepo from "@/lib/documents/repository";

type DbClient = Awaited<ReturnType<typeof createClient>>;

export async function shareExternallyExecutedAgreementWithCouple(
  client: DbClient,
  venueId: string,
  opts: {
    contractId: string;
    documentIds?: string[];
    invoiceId?: string | null;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const contract = await repo.getContract(client, venueId, opts.contractId);
  if (!contract) return { ok: false, message: "Contract not found." };
  if (contract.executionOrigin !== "external") {
    return {
      ok: false,
      message: "Only an externally executed agreement uses this share path. Use Release to client for HTC e-sign contracts.",
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("contracts") as any)
    .update({ is_couple_visible: true })
    .eq("id", opts.contractId)
    .eq("venue_id", venueId);
  if (error) throw error;

  await repo.insertContractActivity(
    client, venueId, opts.contractId,
    "shared_with_couple",
    "Shared externally executed agreement with couple",
    "The original signed agreement is visible in the couple portal. Hello to Cheers did not collect e-signatures for it.",
  );

  for (const documentId of opts.documentIds ?? []) {
    await documentsRepo.updateDocumentMeta(client, venueId, documentId, {
      isCoupleVisible: true,
    });
  }

  if (opts.invoiceId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client.from("invoices") as any)
      .update({ is_couple_visible: true })
      .eq("id", opts.invoiceId)
      .eq("venue_id", venueId);
  }

  return { ok: true };
}

export async function findExternalContractForEvent(
  client: DbClient,
  venueId: string,
  eventId: string,
): Promise<string | null> {
  const { data, error } = await client.from("contracts")
    .select("id")
    .eq("venue_id", venueId)
    .eq("event_id", eventId)
    .eq("execution_origin", "external")
    .eq("status", "signed")
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (error) throw error;
  return data?.id ?? null;
}
