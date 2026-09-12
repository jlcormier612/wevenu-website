import { NextResponse } from "next/server";

import { createClient } from "@/integrations/supabase/server";
import { canAccessDocumentFile } from "@/lib/documents/access";
import { getDocumentForAccess } from "@/lib/documents/repository";
import { createDocumentsSignedUrl } from "@/lib/documents/signed-url";
import { getCurrentVenue } from "@/lib/venue/service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const venue = await getCurrentVenue();
  if (!venue) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = await createClient();
  const row = await getDocumentForAccess(supabase, id);
  if (!row || !canAccessDocumentFile({ kind: "venue", venueId: venue.id }, row)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const url = await createDocumentsSignedUrl(row.storagePath);
  if (!url) return NextResponse.json({ error: "unavailable" }, { status: 404 });

  return NextResponse.redirect(url, { status: 302 });
}
