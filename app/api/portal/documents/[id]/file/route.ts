import { NextResponse } from "next/server";

import { createAdminClient } from "@/integrations/supabase/admin";
import { canAccessDocumentFile } from "@/lib/documents/access";
import { getDocumentForAccess } from "@/lib/documents/repository";
import { createDocumentsSignedUrl } from "@/lib/documents/signed-url";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });

  const { id } = await context.params;
  const admin = createAdminClient();
  const { data: rawIds } = await admin.rpc("_resolve_portal_ids", { p_token: token });
  const ids = Array.isArray(rawIds) ? rawIds[0] : rawIds;
  if (!ids?.client_id || !ids?.venue_id) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const row = await getDocumentForAccess(admin as never, id);
  if (
    !row ||
    !canAccessDocumentFile(
      { kind: "couple", venueId: ids.venue_id, clientId: ids.client_id, eventId: ids.event_id ?? null },
      row,
    )
  ) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const url = await createDocumentsSignedUrl(row.storagePath);
  if (!url) return NextResponse.json({ error: "unavailable" }, { status: 404 });
  return NextResponse.redirect(url, { status: 302 });
}
