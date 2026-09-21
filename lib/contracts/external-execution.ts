/**
 * Record a contract that was executed outside Hello to Cheers.
 *
 * Produces a real `contracts` row (status signed, execution_origin external)
 * so the Event shows an operable agreement — without fabricating HTC
 * e-signature audit (no signer IP/user-agent/consent rows).
 */

import type { createClient } from "@/integrations/supabase/server";
import * as repo from "@/lib/contracts/repository";
import { findExternalContractForEvent } from "@/lib/contracts/external-share";

type DbClient = Awaited<ReturnType<typeof createClient>>;

export type ExternalContractInput = {
  clientId: string;
  eventId: string;
  title: string;
  content: string;
  signedAt?: string | null;
  signerName?: string | null;
};

export type ExternalContractResult =
  | { ok: true; contractId: string; alreadyExisted?: boolean }
  | { ok: false; message: string };

export async function recordExternallyExecutedContract(
  client: DbClient,
  venueId: string,
  input: ExternalContractInput,
): Promise<ExternalContractResult> {
  if (!input.clientId || !input.eventId) {
    return { ok: false, message: "Client and Event are required for an externally executed agreement." };
  }
  if (!input.title.trim()) {
    return { ok: false, message: "Agreement title is required." };
  }
  if (!input.content.trim()) {
    return { ok: false, message: "Agreement content (or a summary of what was signed) is required." };
  }

  const existingId = await findExternalContractForEvent(client, venueId, input.eventId);
  if (existingId) {
    return { ok: true, contractId: existingId, alreadyExisted: true };
  }

  const signedAtIso = input.signedAt
    ? (input.signedAt.includes("T") ? input.signedAt : `${input.signedAt}T12:00:00.000Z`)
    : new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from("contracts") as any)
    .insert({
      venue_id: venueId,
      client_id: input.clientId,
      event_id: input.eventId,
      template_id: null,
      title: input.title.trim(),
      content: input.content.trim(),
      status: "signed",
      execution_origin: "external",
      signer_name: input.signerName?.trim() || null,
      signed_at: signedAtIso,
      sent_at: null,
      is_couple_visible: false,
    })
    .select("id")
    .single();
  if (error) throw error;
  const contractId = (data as { id: string }).id;

  await repo.insertContractActivity(
    client,
    venueId,
    contractId,
    "externally_executed",
    "Recorded as executed outside Hello to Cheers",
    "This agreement was signed in another system. Hello to Cheers did not collect e-signatures for it. The original signed file should be attached as an Event document.",
  );

  return { ok: true, contractId };
}
