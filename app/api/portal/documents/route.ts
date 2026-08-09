import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { triggerAutoComplete } from "@/lib/playbooks/service";
import {
  COUPLE_INSURANCE_CELEBRATION_TYPE,
  COUPLE_INSURANCE_TRIGGER,
  insuranceCommitError,
  normalizeCoupleDocumentSourceType,
  shouldFireInsuranceAutoComplete,
} from "@/lib/portal/couple-insurance-completion";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_couple_documents", { p_token: token });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? { documents: [] });
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
