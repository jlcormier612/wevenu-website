/**
 * POST /api/vendor/conversations/upload
 *
 * File upload for Conversation attachments (Sprint 1) — vendor side.
 * Mirrors app/api/conversations/upload/route.ts's shape exactly, scoped to
 * a vendor's own event-anchored Conversation instead of a venue-anchored
 * one. Vendors have no direct RLS read on `conversations` (every other
 * vendor-facing read goes through a SECURITY DEFINER RPC), so venue_id is
 * resolved via get_vendor_conversation_venue_id rather than a direct table
 * select the way the venue-side route does it.
 */
import { NextResponse } from "next/server";
import { createVendorClient as createAuthClient } from "@/integrations/supabase/server";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "couple-messages";
const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file") as File | null;
    const conversationId = form.get("conversationId")?.toString();

    if (!file) return NextResponse.json({ ok: false, error: "No file." }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ ok: false, error: "File exceeds 20 MB limit." }, { status: 400 });
    if (!conversationId) return NextResponse.json({ ok: false, error: "Invalid conversation." }, { status: 400 });

    const auth = await createAuthClient();
    const { data: venueId, error: rpcError } = await auth.rpc("get_vendor_conversation_venue_id", {
      p_conversation_id: conversationId,
    });

    if (rpcError || !venueId) return NextResponse.json({ ok: false, error: "Invalid conversation." }, { status: 400 });

    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `conversations/${venueId}/${conversationId}/${Date.now()}-${safe}`;

    const supabase = serviceClient();
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: false, contentType: file.type });

    if (uploadErr) {
      console.error("[vendor/conversations/upload]", uploadErr.message);
      return NextResponse.json({ ok: false, error: "Upload failed." }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

    return NextResponse.json({
      ok: true,
      url: urlData.publicUrl,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
