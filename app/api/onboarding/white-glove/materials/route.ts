import { NextResponse } from "next/server";

import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Token-scoped White Glove material upload.
 * FormData: intakeToken, file
 */
export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const form = await request.formData();
  const token = String(form.get("intakeToken") ?? "").trim();
  const file = form.get("file");
  if (!token || !(file instanceof File)) {
    return NextResponse.json({ error: "intakeToken and file are required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: enrollment, error } = await admin
    .from("venue_enrollments")
    .select("id, venue_id, owner_email, onboarding_type, status")
    .eq("intake_token", token)
    .maybeSingle<{
      id: string;
      venue_id: string | null;
      owner_email: string | null;
      onboarding_type: string;
      status: string;
    }>();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!enrollment || enrollment.onboarding_type !== "white_glove" || !enrollment.venue_id) {
    return NextResponse.json({ error: "invalid_token" }, { status: 404 });
  }
  if (enrollment.status === "activated") {
    return NextResponse.json({ error: "already_activated" }, { status: 409 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
  const storagePath = `onboarding/${enrollment.venue_id}/${Date.now()}_${safeName}`;

  const { error: uploadErr } = await admin.storage.from("documents").upload(storagePath, bytes, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  const { data: urlData } = admin.storage.from("documents").getPublicUrl(storagePath);

  const { error: rowErr } = await admin.from("venue_onboarding_materials").insert({
    venue_id: enrollment.venue_id,
    enrollment_id: enrollment.id,
    file_name: file.name,
    content_type: file.type || null,
    byte_size: bytes.length,
    storage_path: storagePath,
    public_url: urlData.publicUrl,
  });
  if (rowErr) {
    return NextResponse.json({ error: rowErr.message }, { status: 500 });
  }

  const { count } = await admin
    .from("venue_onboarding_materials")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", enrollment.venue_id);

  try {
    const { recordCrmWhiteGloveMaterialsReceived } = await import("@shared/relationships");
    await recordCrmWhiteGloveMaterialsReceived({
      productVenueId: enrollment.venue_id,
      ownerEmail: enrollment.owner_email,
      fileCount: count ?? 1,
    });
  } catch (crmErr) {
    console.error("[white-glove/materials] CRM milestone sync failed", crmErr);
  }

  return NextResponse.json({
    ok: true,
    fileName: file.name,
    url: urlData.publicUrl,
  });
}
