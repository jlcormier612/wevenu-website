/**
 * HQ-authorized short-lived download for White Glove materials.
 * Never returns the private documents public URL; signs storage_path after
 * verifying the caller is an HQ admin and the material exists.
 */
import { NextResponse } from "next/server";

import { createAdminClient } from "@/integrations/supabase/admin";
import { resolveWgMaterialStoragePath } from "@/lib/onboarding/materials";
import { createDocumentsSignedUrl } from "@/lib/documents/signed-url";
import { requireAdminUser } from "@/lib/hq/crm-service";

export const runtime = "nodejs";

type MaterialRow = {
  id: string;
  venue_id: string;
  file_name: string;
  content_type: string | null;
  storage_path: string | null;
  public_url: string | null;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const actor = await requireAdminUser();
  if (!actor) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("venue_onboarding_materials")
    .select("id, venue_id, file_name, content_type, storage_path, public_url")
    .eq("id", id)
    .maybeSingle<MaterialRow>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const storagePath = resolveWgMaterialStoragePath(row);
  if (!storagePath) {
    return NextResponse.json({ error: "unavailable" }, { status: 404 });
  }

  // Path must stay under onboarding/{venue_id}/ — reject path traversal / cross-venue keys.
  const expectedPrefix = `onboarding/${row.venue_id}/`;
  if (!storagePath.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const signedUrl = await createDocumentsSignedUrl(storagePath);
  if (!signedUrl) {
    return NextResponse.json({ error: "unavailable" }, { status: 404 });
  }

  const url = new URL(request.url);
  if (url.searchParams.get("format") === "json") {
    return NextResponse.json({
      ok: true,
      signedUrl,
      fileName: row.file_name,
      contentType: row.content_type,
      venueId: row.venue_id,
      expiresInSeconds: 300,
    });
  }

  return NextResponse.redirect(signedUrl, { status: 302 });
}
