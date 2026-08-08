/**
 * POST /api/feedback/upload
 *
 * Authenticated venue/vendor screenshot upload for bug reports.
 * Multipart: file
 * → feedback-screenshots/{venue|vendor}/{user_id}/{timestamp}-{id}.{ext}
 */

import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/integrations/supabase/server";
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
  return createServiceClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(request: Request) {
  try {
    const auth = await createClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const form = await request.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ ok: false, error: "No file." }, { status: 400 });
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

    // Prefer vendor surface when the user is an active vendor; else venue.
    const { data: vendorUser } = await auth
      .from("vendor_users")
      .select("vendor_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle<{ vendor_id: string }>();

    const surface = vendorUser ? "vendor" : "venue";
    const actorId = vendorUser?.vendor_id ?? user.id;
    const path = `${surface}/${actorId}/${Date.now()}-${randomUUID().slice(0, 8)}.${resolved.ext}`;

    const supabase = serviceClient();
    const { error: uploadError } = await supabase.storage
      .from(FEEDBACK_SCREENSHOTS_BUCKET)
      .upload(path, file, { upsert: false, contentType: file.type || resolved.mime });

    if (uploadError) {
      console.error("[feedback/upload]", uploadError.message);
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
