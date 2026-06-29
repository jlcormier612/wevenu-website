/**
 * POST /api/portal/upload
 *
 * Accepts a multipart form with:
 *   token: portal access token
 *   file: image file
 *   type: 'cover' | 'couple' | 'gallery'
 *
 * Uploads to Supabase Storage bucket 'couple-media' using service role key.
 * Returns the public URL.
 *
 * Path: couple-media/{venue_id}/{client_id}/{type}-{timestamp}.{ext}
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing storage credentials.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const token   = form.get("token")?.toString();
    const file    = form.get("file") as File | null;
    const type    = form.get("type")?.toString() ?? "cover";

    if (!token || !file) {
      return NextResponse.json({ ok: false, error: "Missing token or file." }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "File too large. Maximum 10MB." }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ ok: false, error: "Only image files are accepted." }, { status: 400 });
    }

    const supabase = getServiceClient();

    // Validate portal token and get context
    const { data: sessionData } = await supabase
      .from("client_portal_sessions")
      .select("venue_id, client_id")
      .eq("access_token", token)
      .maybeSingle<{ venue_id: string; client_id: string }>();

    if (!sessionData) {
      return NextResponse.json({ ok: false, error: "Invalid portal token." }, { status: 401 });
    }

    const ext = file.type === "image/webp" ? "webp"
      : file.type === "image/png" ? "png"
      : file.type === "image/gif" ? "gif" : "jpg";
    const path = `${sessionData.venue_id}/${sessionData.client_id}/${type}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("couple-media")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      console.error("[upload]", uploadError.message);
      return NextResponse.json({ ok: false, error: "Upload failed. Please try again." }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from("couple-media").getPublicUrl(path);

    return NextResponse.json({ ok: true, url: urlData.publicUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
