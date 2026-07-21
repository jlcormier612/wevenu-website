/**
 * POST /api/portal/upload
 *
 * Accepts a multipart form with:
 *   token: portal access token
 *   file: image file
 *   type: 'cover' | 'couple' | 'gallery'
 *
 * Uploads to Supabase Storage bucket 'client-media' using service role key.
 * Returns the public URL.
 *
 * Path: client-media/{venue_id}/{client_id}/{type}-{timestamp}.{ext}
 *
 * RC-Launch Validation, Sprint 2 — this hardcoded the bucket's original
 * name from its very first migration comment ("client-media"); the
 * migration that actually created the bucket (20260629270000_couple_
 * profiles.sql) renamed it to "client-media" and this route was never
 * updated. No bucket named "client-media" has ever existed, so every
 * upload through this route (wedding website hero/cover photo, couple
 * portal profile photo, couple document uploads — see callers in
 * website-editor.tsx, portal-shell.tsx, couple-documents-section.tsx)
 * has always failed with a real "Bucket not found" error. lib/storage.ts
 * and app/api/portal/media/route.ts already correctly reference
 * "client-media" — this route was the one holdout.
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
      .from("client-media")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      console.error("[upload]", uploadError.message);
      return NextResponse.json({ ok: false, error: "Upload failed. Please try again." }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from("client-media").getPublicUrl(path);

    return NextResponse.json({ ok: true, url: urlData.publicUrl, path });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
