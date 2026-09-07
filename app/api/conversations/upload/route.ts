/**
 * POST /api/conversations/upload
 *
 * File upload for Conversation attachments — venue side.
 * Reuses couple-messages under conversations/ prefix.
 * Validates MIME + size; channel-specific Twilio limits are enforced at send time.
 */
import { NextResponse } from "next/server";
import { createClient as createAuthClient } from "@/integrations/supabase/server";
import { createClient } from "@supabase/supabase-js";
import {
  CONVERSATION_ATTACH_MIME_TYPES,
  CONVERSATION_STORAGE_MAX_BYTES,
} from "@/lib/conversations/attachment-constraints";

const BUCKET = "couple-messages";
const MAX_SIZE = CONVERSATION_STORAGE_MAX_BYTES;

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
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ ok: false, error: "File exceeds 20 MB limit." }, { status: 400 });
    }
    const mime = (file.type || "").toLowerCase();
    if (!(CONVERSATION_ATTACH_MIME_TYPES as readonly string[]).includes(mime)) {
      return NextResponse.json({
        ok: false,
        error: "That file type isn’t allowed for conversation attachments.",
      }, { status: 400 });
    }

    const auth = await createAuthClient();
    const { data: conversation } = await auth
      .from("conversations")
      .select("id, venue_id")
      .eq("id", conversationId ?? "")
      .maybeSingle<{ id: string; venue_id: string }>();

    if (!conversation) return NextResponse.json({ ok: false, error: "Invalid conversation." }, { status: 400 });

    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `conversations/${conversation.venue_id}/${conversation.id}/${Date.now()}-${safe}`;

    const supabase = serviceClient();
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: false, contentType: mime || file.type });

    if (uploadErr) {
      console.error("[conversations/upload]", uploadErr.message);
      return NextResponse.json({ ok: false, error: "Upload failed." }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

    return NextResponse.json({
      ok: true,
      url: urlData.publicUrl,
      file_name: file.name,
      file_size: file.size,
      mime_type: mime || file.type,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
