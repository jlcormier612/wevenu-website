import { NextResponse } from "next/server";

import { createAdminClient } from "@/integrations/supabase/admin";
import { createVendorClient } from "@/integrations/supabase/server";
import { canAccessDocumentFile } from "@/lib/documents/access";
import { getDocumentForAccess } from "@/lib/documents/repository";
import { createDocumentsSignedUrl } from "@/lib/documents/signed-url";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const auth = await createVendorClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: vendorUser } = await auth
    .from("vendor_users")
    .select("vendor_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle<{ vendor_id: string }>();
  if (!vendorUser?.vendor_id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: assignments } = await auth
    .from("event_vendor_assignments")
    .select("event_id")
    .eq("vendor_id", vendorUser.vendor_id);
  const eventIds = ((assignments ?? []) as { event_id: string }[]).map((a) => a.event_id);

  const admin = createAdminClient();
  const row = await getDocumentForAccess(admin as never, id);
  if (!row || !canAccessDocumentFile({ kind: "vendor", vendorId: vendorUser.vendor_id, eventIds }, row)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const url = await createDocumentsSignedUrl(row.storagePath);
  if (!url) return NextResponse.json({ error: "unavailable" }, { status: 404 });
  return NextResponse.redirect(url, { status: 302 });
}
