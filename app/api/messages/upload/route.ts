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
    const file     = form.get("file") as File | null;
    const threadId = form.get("threadId")?.toString();

    if (!file) return NextResponse.json({ ok: false, error: "No file." }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ ok: false, error: "File exceeds 20 MB limit." }, { status: 400 });

    // Resolve venue + client from thread
    const auth = await createAuthClient();
    const { data: thread } = await auth
      .from("couple_threads")
      .select("venue_id, client_id")
      .eq("id", threadId ?? "")
      .maybeSingle<{ venue_id: string; client_id: string }>();

    if (!thread) return NextResponse.json({ ok: false, error: "Invalid thread." }, { status: 400 });

    const ext = file.name.split(".").pop() ?? "bin";
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${thread.venue_id}/${thread.client_id}/messages/${Date.now()}-${safe}`;

    const supabase = serviceClient();
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: false, contentType: file.type });

    if (uploadErr) {
      console.error("[messages/upload]", uploadErr.message);
      return NextResponse.json({ ok: false, error: "Upload failed." }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

    return NextResponse.json({
      ok:        true,
      url:       urlData.publicUrl,
      path,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
