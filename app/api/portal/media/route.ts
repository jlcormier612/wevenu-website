/**
 * POST /api/portal/media
 *
 * Uploads a photo to Supabase Storage and records it in client_media.
 * Unlike the legacy /api/portal/upload route, this one:
 *   - Uses the client-media bucket (private-by-category, public URLs)
 *   - Writes a client_media row via the add_couple_media SECURITY DEFINER
 *   - Returns mediaId so the client can call set_hero_photo, etc.
 *
 * Multipart form fields:
 *   token       portal access token
 *   file        image file (max 10MB)
 *   category    engagement | inspiration | memory | gallery | venue_visit | dress | other
 *   visibility  private (default) | venue | website
 *   caption     optional text
 */

import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";
import { uploadFile, getPublicUrl, removeFile } from "@/lib/storage";
import { createAdminClient } from "@/integrations/supabase/admin";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const token      = form.get("token")?.toString();
    const file       = form.get("file") as File | null;
    const category   = form.get("category")?.toString()   ?? "other";
    const visibility = form.get("visibility")?.toString() ?? "private";
    const caption    = form.get("caption")?.toString()    ?? "";

    if (!token || !file) {
      return NextResponse.json({ ok: false, error: "Missing token or file." }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "File too large. Maximum 10 MB." }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ ok: false, error: "Only image files are accepted." }, { status: 400 });
    }

    // Validate token and get venue_id / client_id via admin client (bypasses RLS)
    const admin = createAdminClient();
    const { data: session } = await admin
      .from("client_portal_sessions")
      .select("venue_id, client_id")
      .eq("access_token", token)
      .maybeSingle<{ venue_id: string; client_id: string }>();

    if (!session) {
      return NextResponse.json({ ok: false, error: "Invalid portal token." }, { status: 401 });
    }

    // Build storage path: {venue_id}/{client_id}/{category}-{uuid}.{ext}
    const ext = (
      file.type === "image/png"  ? "png" :
      file.type === "image/webp" ? "webp" :
      file.type === "image/gif"  ? "gif" : "jpg"
    );
    const uuid = crypto.randomUUID();
    const path = `${session.venue_id}/${session.client_id}/${category}-${uuid}.${ext}`;

    const uploadResult = await uploadFile(path, file, file.type);
    if (!uploadResult.ok) {
      console.error("[media/upload] storage error:", uploadResult.error);
      return NextResponse.json({ ok: false, error: "Upload failed. Please try again." }, { status: 500 });
    }

    const fileUrl = getPublicUrl(path);

    // Write the client_media record via SECURITY DEFINER (validates token again internally)
    const supabase = await createClient();
    const { data: mediaData } = await supabase.rpc("add_couple_media", {
      p_token:       token,
      p_file_url:    fileUrl,
      p_file_name:   file.name,
      p_mime_type:   file.type,
      p_media_type:  "image",
      p_visibility:  visibility,
      p_category:    category,
      p_caption:     caption,
    });

    const result = mediaData as { ok?: boolean; mediaId?: string } | null;
    if (!result?.ok) {
      // Upload succeeded but DB write failed — clean up storage
      void removeFile(path);
      return NextResponse.json({ ok: false, error: "Failed to save media record." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, mediaId: result.mediaId, fileUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[media/upload]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
