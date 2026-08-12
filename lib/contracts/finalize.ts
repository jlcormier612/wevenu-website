/**
 * Work Package D4 — the explicit "Finalize Contract" action. Deliberately
 * separate from signing itself (Step 31: "Do not finalize merely because
 * someone signed if the existing business rules require another step") —
 * `sign_contract()` (the anonymous, token-gated RPC) only ever sets
 * `contracts.status='signed'`; nothing about finalization happens until a
 * venue user explicitly triggers this, authenticated, from the Contract
 * Detail page.
 */
import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { getCurrentVenue } from "@/lib/venue/service";
import { getContractDetail } from "@/lib/contracts/service";
import * as documentIntegration from "@/lib/contracts/document-integration";
import { generateContractPdf } from "@/lib/contracts/pdf";
import { insertContractActivity } from "@/lib/contracts/repository";
import type { ContractActionResult } from "@/lib/contracts/types";

const BUCKET = "contract-representations";

// createAdminClient() is this codebase's own existing service-role
// pattern (integrations/supabase/admin.ts) — the storage bucket's own
// policy (this phase's migration) only grants `select` to `authenticated`;
// writing the PDF bytes requires bypassing RLS, reusing the established
// mechanism rather than a second one.
const getServiceClient = createAdminClient;

export async function finalizeContract(contractId: string): Promise<ContractActionResult & { downloadUrl?: string }> {
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };

  const contract = await getContractDetail(contractId);
  if (!contract) return { ok: false, message: "Contract not found." };
  if (contract.status !== "signed") {
    return { ok: false, message: "Only a signed contract can be finalized." };
  }

  const { assertCustomerSafeContractContent } = await import("@/lib/contracts/starters");
  const safety = assertCustomerSafeContractContent(contract.content);
  if (!safety.ok) {
    return { ok: false, message: safety.message };
  }

  const supabase = await createClient();
  const documentId = await documentIntegration.getContractDocumentId(supabase, contractId);
  if (!documentId) {
    // A contract that reached "signed" without ever having been sent
    // through this phase's own publish-on-send path (e.g. one signed
    // before this migration existed) has no canonical Document to
    // finalize. Documented explicitly rather than silently fabricating
    // one here — see docs/contract-lifecycle-implementation.md.
    return { ok: false, message: "This contract has no linked Document record to finalize — it may predate this feature. Contact support." };
  }

  // Generate the PDF from the exact current (signed) content — the same
  // data `getContract` already returned, no separate re-fetch, no risk
  // of finalizing different content than what's on screen.
  const pdfBuffer = await generateContractPdf(contract, venue);

  const storagePath = `${venue.id}/${contractId}/final-${Date.now()}.pdf`;
  const serviceClient = getServiceClient();
  const { error: uploadError } = await serviceClient.storage
    .from(BUCKET)
    .upload(storagePath, pdfBuffer, { contentType: "application/pdf", upsert: false });
  if (uploadError) return { ok: false, message: `Could not generate the final PDF: ${uploadError.message}` };

  const { data: { user } } = await supabase.auth.getUser();
  const actor = { type: "venue" as const, id: user?.id ?? venue.id };

  try {
    await documentIntegration.finalizeContractDocument(supabase, documentId, actor, {
      storagePath,
      storageUrl: null, // deliberately no public URL stored — every real access goes through a fresh signed URL (see getContractPdfUrl)
      byteSize: pdfBuffer.byteLength,
    });
  } catch (err) {
    // The PDF is already uploaded but the Document Domain write failed —
    // clean up the orphaned file rather than leave a representation-less
    // artifact sitting in storage.
    await serviceClient.storage.from(BUCKET).remove([storagePath]);
    throw err;
  }

  await insertContractActivity(
    supabase, venue.id, contractId, "finalized",
    "Contract finalized — final signed copy generated",
    undefined,
    user?.id ?? null,
    null,
  );

  return { ok: true };
}

/** A fresh, short-lived signed URL for the finalized PDF — never a stored public path (Step 41/42's own requirement). */
export async function getContractPdfUrl(contractId: string): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };

  const contract = await getContractDetail(contractId);
  if (!contract) return { ok: false, message: "Contract not found." };

  const supabase = await createClient();
  const documentId = await documentIntegration.getContractDocumentId(supabase, contractId);
  if (!documentId) return { ok: false, message: "This contract has not been finalized yet." };

  const service = (await import("@/lib/document-domain/integration/service")).createDocumentService(supabase);
  const representation = await service.getCurrentRepresentation(documentId);
  if (!representation || !representation.storagePath) return { ok: false, message: "This contract has not been finalized yet." };

  const serviceClient = getServiceClient();
  const { data, error } = await serviceClient.storage.from(BUCKET).createSignedUrl(representation.storagePath, 300);
  if (error || !data) return { ok: false, message: "Could not generate a download link." };
  return { ok: true, url: data.signedUrl };
}
