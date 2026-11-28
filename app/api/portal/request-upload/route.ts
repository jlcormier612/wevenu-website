/**
 * POST /api/portal/request-upload
 *
 * Couple portal Request Center file attachment. Validates the portal access
 * token via the existing portal request loader, then writes to
 * `request-uploads` with the service role (same pattern as /api/portal/upload).
 *
 * Form: token, requestId, file
 * Path: {requestId}/{timestamp}.{ext}
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getPortalRequestDetail } from "@/lib/requests/portal";
import {
  CUSTOMER_UPLOAD_FAILED_MESSAGE,
  CUSTOMER_UPLOAD_INVALID_MESSAGE,
  customerFacingUploadError,
} from "@/lib/storage/customer-upload-errors";

const BUCKET = "request-uploads";
const MAX_BYTES = 10 * 1024 * 1024;

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing storage credentials.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const token = form.get("token")?.toString();
    const requestId = form.get("requestId")?.toString();
    const file = form.get("file");
    if (!token || !requestId || !(file instanceof File)) {
      return NextResponse.json({ ok: false, error: CUSTOMER_UPLOAD_INVALID_MESSAGE }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: "File too large. Maximum 10MB." }, { status: 400 });
    }

    const detail = await getPortalRequestDetail(token, requestId);
    if (!detail) {
      return NextResponse.json({ ok: false, error: "Request not found." }, { status: 404 });
    }

    const supabase = getServiceClient();
    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const path = `${requestId}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: false, contentType: file.type || "application/octet-stream" });
    if (uploadError) {
      console.error("[portal/request-upload]", uploadError.message);
      return NextResponse.json(
        { ok: false, error: customerFacingUploadError(uploadError.message) },
        { status: 500 },
      );
    }
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ ok: true, url: urlData.publicUrl, path });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Unknown error";
    console.error("[portal/request-upload]", raw);
    return NextResponse.json(
      { ok: false, error: customerFacingUploadError(raw) || CUSTOMER_UPLOAD_FAILED_MESSAGE },
      { status: 500 },
    );
  }
}
