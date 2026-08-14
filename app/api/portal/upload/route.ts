/**
 * POST /api/portal/upload
 *
 * Accepts a multipart form with:
 *   token: portal access token
 *   file: image file (default) or image/PDF when type=document
 *   type: 'cover' | 'couple' | 'gallery' | 'story' | 'document' | ... (any short label —
 *         used only as the stored file's name prefix, not validated against
 *         a fixed enum). When type is "document", PDF is accepted (couple COI).
 *
 * Uploads to Supabase Storage bucket 'client-media' using service role key.
 * Returns the public URL.
 *
 * Path: client-media/{venue_id}/{client_id}/{type}-{timestamp}.{ext}
 *
 * Callers: wedding website hero/cover photo, gallery photos, and the Our
 * Story section's own optional photo (website-editor.tsx), couple portal
 * profile photo (portal-shell.tsx), couple document uploads
 * (couple-documents-section.tsx).
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveImageFile, resolvePortalDocumentFile } from "@/lib/storage";

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

    // Document uploads (COIs) accept PDF + images; website/media stays images-only.
    const allowDocuments = type === "document";
    const resolved = allowDocuments ? resolvePortalDocumentFile(file) : resolveImageFile(file);
    if (!resolved) {
      return NextResponse.json({
        ok: false,
        error: allowDocuments
          ? "Only PDF or image files are accepted (JPG, PNG, GIF, WEBP, HEIC, PDF)."
          : "Only image files are accepted (JPG, PNG, GIF, WEBP, HEIC, and similar).",
      }, { status: 400 });
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

    // Real extension matching the file's actual bytes, not every
    // non-explicit type silently renamed to ".jpg" regardless of format.
    const path = `${sessionData.venue_id}/${sessionData.client_id}/${type}-${Date.now()}.${resolved.ext}`;

    const { error: uploadError } = await supabase.storage
      .from("client-media")
      .upload(path, file, { upsert: true, contentType: file.type || resolved.mime });

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
