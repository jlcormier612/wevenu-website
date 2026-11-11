/**
 * Token-authenticated contract PDF for the couple portal Documents viewer.
 * Same readable PDF as venue Documents; auth is portal token + couple visibility.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { getContractDocumentId } from "@/lib/contracts/document-integration";
import { generateContractPdf } from "@/lib/contracts/pdf";
import { getContract } from "@/lib/contracts/repository";
import { createDocumentService } from "@/lib/document-domain/integration/service";
import { contractWorkingCopyNote } from "@/lib/document-workspace/viewer";
import type { WorkspacePdfResult } from "@/lib/document-workspace/render-pdf";
import { getVenueById } from "@/lib/venue/repository";

const BUCKET = "contract-pdfs";

function safeFilename(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim();
  return `${cleaned || "Contract"}.pdf`;
}

async function fetchBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export async function renderCoupleContractPdf(
  token: string,
  contractId: string,
): Promise<WorkspacePdfResult> {
  const admin = createAdminClient();
  const { data: rawIds } = await admin.rpc("_resolve_portal_ids", { p_token: token });
  const ids = Array.isArray(rawIds) ? rawIds[0] : rawIds;
  if (!ids?.client_id || !ids?.venue_id) {
    return { ok: false, status: 401, message: "Invalid portal link." };
  }

  const { data: visible } = await admin
    .from("contracts")
    .select("id")
    .eq("id", contractId)
    .eq("venue_id", ids.venue_id)
    .eq("client_id", ids.client_id)
    .eq("is_couple_visible", true)
    .maybeSingle<{ id: string }>();
  if (!visible) {
    return { ok: false, status: 404, message: "Contract not found." };
  }

  const contract = await getContract(admin as never, ids.venue_id, contractId);
  if (!contract || contract.clientId !== ids.client_id) {
    return { ok: false, status: 404, message: "Contract not found." };
  }

  const filename = safeFilename(contract.title);

  const documentId = await getContractDocumentId(admin as never, contractId);
  if (documentId) {
    const service = createDocumentService(admin as never);
    const representation = await service.getCurrentRepresentation(documentId);
    if (representation?.storagePath) {
      const { data, error } = await admin.storage
        .from(BUCKET)
        .createSignedUrl(representation.storagePath, 300);
      if (!error && data?.signedUrl) {
        const bytes = await fetchBytes(data.signedUrl);
        if (bytes) return { ok: true, bytes, filename };
      }
    }
  }

  const venue = await getVenueById(admin as never, ids.venue_id);
  if (!venue) {
    return { ok: false, status: 404, message: "Venue not found." };
  }

  const buffer = await generateContractPdf(
    contract,
    venue,
    contract.signers,
    contractWorkingCopyNote(contract.status),
  );
  return { ok: true, bytes: new Uint8Array(buffer), filename };
}
