/**
 * POST /api/portal/product-feedback/upload
 *
 * Portal token–authenticated screenshot upload for client bug reports.
 * Multipart: token, file
 * → feedback-screenshots/client/{venue_id}/{client_id}/{timestamp}-{id}.{ext}
 */

import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveImageFile } from "@/lib/storage";
import {
  FEEDBACK_SCREENSHOTS_BUCKET,
  MAX_FEEDBACK_SCREENSHOT_BYTES,
  MAX_FEEDBACK_SCREENSHOT_MB,
} from "@/lib/feedback/attachments";

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing storage credentials.");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const token = form.get("token")?.toString();
    const file = form.get("file") as File | null;

    if (!token || !file) {
      return NextResponse.json({ ok: false, error: "Missing token or file." }, { status: 400 });
    }
    if (file.size > MAX_FEEDBACK_SCREENSHOT_BYTES) {
      return NextResponse.json(
        { ok: false, error: `File too large. Maximum ${MAX_FEEDBACK_SCREENSHOT_MB}MB.` },
        { status: 400 },
      );
    }

    const resolved = resolveImageFile(file);
    if (!resolved) {
      return NextResponse.json(
        { ok: false, error: "Only image files are accepted (JPG, PNG, WEBP, HEIC)." },
        { status: 400 },
      );
    }

    const supabase = serviceClient();
    const { data: sessionData } = await supabase
      .from("client_portal_sessions")
      .select("venue_id, client_id")
      .eq("access_token", token)
      .maybeSingle<{ venue_id: string; client_id: string }>();

    if (!sessionData) {
      return NextResponse.json({ ok: false, error: "Invalid portal token." }, { status: 401 });
    }

    const path =
      `client/${sessionData.venue_id}/${sessionData.client_id}/${Date.now()}-${randomUUID().slice(0, 8)}.${resolved.ext}`;

    const { error: uploadError } = await supabase.storage
      .from(FEEDBACK_SCREENSHOTS_BUCKET)
      .upload(path, file, { upsert: false, contentType: file.type || resolved.mime });

    if (uploadError) {
      console.error("[portal/product-feedback/upload]", uploadError.message);
      return NextResponse.json({ ok: false, error: "Upload failed." }, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from(FEEDBACK_SCREENSHOTS_BUCKET)
      .getPublicUrl(path);

    return NextResponse.json({
      ok: true,
      url: urlData.publicUrl,
      path,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type || resolved.mime,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
