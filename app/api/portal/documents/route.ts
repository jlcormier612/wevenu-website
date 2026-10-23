import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { renderExecutedContractContent } from "@/lib/contracts/executed-content";
import { triggerAutoComplete } from "@/lib/playbooks/service";
import {
  COUPLE_INSURANCE_CELEBRATION_TYPE,
  COUPLE_INSURANCE_TRIGGER,
  insuranceCommitError,
  normalizeCoupleDocumentSourceType,
  shouldFireInsuranceAutoComplete,
} from "@/lib/portal/couple-insurance-completion";
import {
  ensureCoupleInsuranceVenueDocument,
  healSharedCoupleInsuranceVenueDocuments,
} from "@/lib/portal/ensure-couple-insurance-venue-document";
import { mergeSharedEventOrderIntoCoupleDocuments } from "@/lib/portal/couple-documents-event-order";

type PortalDoc = {
  id?: string;
  docType?: string;
  status?: string | null;
  content?: string | null;
  fileUrl?: string | null;
  [key: string]: unknown;
};

/** Render-time only: fill Fully Executed signature blanks from contract_signers. */
async function withFilledSignedContractContent(documents: PortalDoc[]): Promise<PortalDoc[]> {
  const signedContracts = documents.filter(
    (d) => d.docType === "contract" && d.status === "signed" && d.id && d.content,
  );
  if (signedContracts.length === 0) return documents;

  const admin = createAdminClient();
  const ids = signedContracts.map((d) => d.id!);
  const { data: rows } = await admin
    .from("contract_signers")
    .select("contract_id, signer_type, signer_name, signed_at, is_required")
    .in("contract_id", ids);

  const byContract = new Map<string, {
    signerType: "venue" | "client";
    signerName: string | null;
    signedAt: string | null;
    isRequired?: boolean;
  }[]>();
  for (const r of (rows ?? []) as {
    contract_id: string;
    signer_type: string;
    signer_name: string | null;
    signed_at: string | null;
    is_required: boolean;
  }[]) {
    const list = byContract.get(r.contract_id) ?? [];
    list.push({
      signerType: r.signer_type === "venue" ? "venue" : "client",
      signerName: r.signer_name,
      signedAt: r.signed_at,
      isRequired: r.is_required,
    });
    byContract.set(r.contract_id, list);
  }

  return documents.map((doc) => {
    if (doc.docType !== "contract" || doc.status !== "signed" || !doc.id || !doc.content) {
      return doc;
    }
    const signers = byContract.get(doc.id) ?? [];
    if (signers.length === 0) return doc;
    return {
      ...doc,
      content: renderExecutedContractContent(doc.content, signers, { status: "signed" }),
    };
  });
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });
  const supabase = await createClient();

  // Heal venue-mirror visibility so couple-originated insurance is not listed
  // again under "From your venue" (couple_documents remains the portal SoT).
  const admin = createAdminClient();
  const { data: rawIds } = await admin.rpc("_resolve_portal_ids", { p_token: token });
  const ids = Array.isArray(rawIds) ? rawIds[0] : rawIds;
  if (ids?.venue_id && ids?.client_id) {
    await healSharedCoupleInsuranceVenueDocuments(
      admin as never,
      ids.venue_id,
      ids.client_id,
      ids.event_id ?? null,
    ).catch(() => null);
  }

  const { data, error } = await supabase.rpc("get_couple_documents", { p_token: token });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { isDocumentsPublicUrl } = await import("@/lib/documents/access");
  const payload = (data ?? { documents: [] }) as { documents?: PortalDoc[] };
  const documents = (payload.documents ?? []).map((doc) => {
    if (!doc.id || !doc.fileUrl || !isDocumentsPublicUrl(doc.fileUrl)) return doc;
    if (doc.docType === "contract" || doc.docType === "invoice") return doc;
    return { ...doc, fileUrl: `/api/portal/documents/${doc.id}/file?token=${encodeURIComponent(token)}` };
  });

  // P2-D: shared final Event Order is discoverable in Documents (portal RPC
  // already requires shared_at — drafts never appear).
  const { data: eoRows } = await supabase.rpc("get_event_order_for_portal", { p_token: token });
  const eoList = (eoRows ?? []) as Array<{
    id: string;
    shared_at: string | null;
    client_agreed_at?: string | null;
    revision?: number | null;
  }>;
  const eoHead = eoList[0];
  const withEventOrder = mergeSharedEventOrderIntoCoupleDocuments(
    documents,
    eoHead?.id && eoHead.shared_at
      ? {
          id: eoHead.id,
          sharedAt: eoHead.shared_at,
          clientAgreedAt: eoHead.client_agreed_at ?? null,
          revision: eoHead.revision ?? null,
        }
      : null,
  );

  const filled = await withFilledSignedContractContent(withEventOrder);
  return NextResponse.json({ ...payload, documents: filled });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { token, name, fileUrl, fileSize, mimeType, shareWithVenue, sourceType } = body;
  if (!token || !name || !fileUrl)
    return NextResponse.json({ error: "missing_params" }, { status: 400 });

  const supabase = await createClient();

  // Resolve client / venue / event from portal token
  const { data: rawIds } = await supabase.rpc("_resolve_portal_ids", { p_token: token });
  const ids = Array.isArray(rawIds) ? rawIds[0] : rawIds;
  if (!ids?.client_id)
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });

  const share = Boolean(shareWithVenue);
  const normalizedSource = normalizeCoupleDocumentSourceType(sourceType);
  const commitErr = insuranceCommitError(normalizedSource, share);
  if (commitErr) {
    return NextResponse.json({ error: commitErr }, { status: 400 });
  }

  // Portal couples authenticate via access token, not venue_users RLS —
  // mirror storage/upload: validate token, then write with service role.
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("couple_documents")
    .insert({
      client_id:        ids.client_id,
      name,
      file_url:         fileUrl,
      file_size:        fileSize ?? null,
      mime_type:        mimeType ?? null,
      uploaded_by:      "couple",
      share_with_venue: share,
      source_type:      normalizedSource,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let celebrated = false;
  if (
    shouldFireInsuranceAutoComplete({ sourceType: normalizedSource, shareWithVenue: share })
    && ids.venue_id
    && ids.event_id
  ) {
    // Existing playbook trigger — completes matching event_tasks (couple insurance
    // and any coordinator Vendor COIs rows sharing the same trigger string).
    // source_type "document" is CHECK-safe on event_tasks (not couple_document).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await triggerAutoComplete(admin as any, ids.venue_id, ids.event_id, COUPLE_INSURANCE_TRIGGER, "document", data.id);

    // Register the same file in venue documents so All Documents can show it.
    // Does not re-fire triggers (idempotent insert only).
    await ensureCoupleInsuranceVenueDocument(admin as never, {
      venueId: ids.venue_id,
      clientId: ids.client_id,
      eventId: ids.event_id,
      coupleDocumentId: data.id,
      name,
      fileUrl,
      fileSize: fileSize ?? null,
      mimeType: mimeType ?? null,
    });

    const { error: celebrationError } = await admin.from("luv_celebrations").insert({
      venue_id: ids.venue_id,
      client_id: ids.client_id,
      event_id: ids.event_id,
      celebration_type: COUPLE_INSURANCE_CELEBRATION_TYPE,
      entity_id: data.id,
    });
    celebrated = !celebrationError;
  }

  return NextResponse.json({ id: data.id, celebrated });
}
