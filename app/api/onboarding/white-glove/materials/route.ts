import { NextResponse } from "next/server";

import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import {
  validateWgMaterialFile,
  wgMaterialStoragePath,
  WG_MATERIAL_MAX_COUNT,
  WG_MATERIALS_BUCKET,
} from "@/lib/onboarding/materials";

export const runtime = "nodejs";

type EnrollmentRow = {
  id: string;
  venue_id: string | null;
  owner_email: string | null;
  onboarding_type: string;
  status: string;
  white_glove_status: string | null;
};

async function loadEnrollmentByToken(token: string) {
  const admin = createAdminClient();
  const { data: enrollment, error } = await admin
    .from("venue_enrollments")
    .select("id, venue_id, owner_email, onboarding_type, status, white_glove_status")
    .eq("intake_token", token)
    .maybeSingle<EnrollmentRow>();
  return { admin, enrollment, error };
}

/**
 * GET — list materials for an authorized intake token (resumable waiting page).
 * Query: ?intakeToken=
 */
export async function GET(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const token = new URL(request.url).searchParams.get("intakeToken")?.trim() ?? "";
  if (!token) {
    return NextResponse.json({ error: "intakeToken required" }, { status: 400 });
  }

  const { admin, enrollment, error } = await loadEnrollmentByToken(token);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!enrollment || enrollment.onboarding_type !== "white_glove" || !enrollment.venue_id) {
    return NextResponse.json({ error: "invalid_token" }, { status: 404 });
  }

  const { data: rows, error: listErr } = await admin
    .from("venue_onboarding_materials")
    .select("id, file_name, content_type, byte_size, uploaded_at")
    .eq("venue_id", enrollment.venue_id)
    .order("uploaded_at", { ascending: false });
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    activated: enrollment.status === "activated",
    whiteGloveStatus: enrollment.white_glove_status,
    materials: (rows ?? []).map((m) => ({
      id: m.id,
      fileName: m.file_name,
      contentType: m.content_type,
      byteSize: m.byte_size,
      uploadedAt: m.uploaded_at,
    })),
  });
}

/**
 * Token-scoped White Glove material upload.
 * FormData: intakeToken, file
 * Stores storage_path only for access; public_url kept null (private bucket).
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

  const { admin, enrollment, error } = await loadEnrollmentByToken(token);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!enrollment || enrollment.onboarding_type !== "white_glove" || !enrollment.venue_id) {
    return NextResponse.json({ error: "invalid_token" }, { status: 404 });
  }
  if (enrollment.status === "activated") {
    return NextResponse.json({ error: "already_activated" }, { status: 409 });
  }

  const validated = validateWgMaterialFile(file);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.message }, { status: 400 });
  }

  const { count: existingCount } = await admin
    .from("venue_onboarding_materials")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", enrollment.venue_id);
  if ((existingCount ?? 0) >= WG_MATERIAL_MAX_COUNT) {
    return NextResponse.json(
      { error: `You can upload up to ${WG_MATERIAL_MAX_COUNT} files here. Email us if you need to send more.` },
      { status: 400 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const storagePath = wgMaterialStoragePath(enrollment.venue_id, validated.safeFileName);

  const { error: uploadErr } = await admin.storage.from(WG_MATERIALS_BUCKET).upload(storagePath, bytes, {
    contentType: validated.mime,
    upsert: false,
  });
  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  const { data: inserted, error: rowErr } = await admin
    .from("venue_onboarding_materials")
    .insert({
      venue_id: enrollment.venue_id,
      enrollment_id: enrollment.id,
      file_name: file.name,
      content_type: validated.mime,
      byte_size: bytes.length,
      storage_path: storagePath,
      // Private bucket — do not store a fake public URL operators cannot open.
      public_url: null,
    })
    .select("id, file_name, uploaded_at")
    .single();

  if (rowErr || !inserted) {
    await admin.storage.from(WG_MATERIALS_BUCKET).remove([storagePath]);
    return NextResponse.json({ error: rowErr?.message ?? "Could not save file metadata." }, { status: 500 });
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
    id: inserted.id,
    fileName: inserted.file_name,
    uploadedAt: inserted.uploaded_at,
  });
}
