/**
 * POST /api/conversations/upload
 *
 * File upload for Conversation attachments (RC2, Milestone 1) — venue side.
 * Mirrors app/api/messages/upload/route.ts's shape exactly (couple-chat's
 * proven upload flow), scoped to a Conversation instead of a couple_thread.
 * Reuses the same "couple-messages" storage bucket under a conversations/
 * prefix rather than provisioning a second bucket for the same 20MB/
 * restricted-type shape.
 */
import { NextResponse } from "next/server";
import { createClient as createAuthClient } from "@/integrations/supabase/server";
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

    // Resolve venue from the conversation, scoped to the authenticated
    // coordinator's own venue (not a service-role-wide lookup) — matches
    // every other conversations read/write's reliance on the caller's own
    // authenticated session.
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
      .upload(path, file, { upsert: false, contentType: file.type });

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
      mime_type: file.type,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
