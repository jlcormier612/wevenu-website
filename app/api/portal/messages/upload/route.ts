import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "couple-messages";
const MAX_SIZE = 20 * 1024 * 1024;

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(request: Request) {
  try {
    const form  = await request.formData();
    const token = form.get("token")?.toString();
    const file  = form.get("file") as File | null;

    if (!token || !file) return NextResponse.json({ ok: false, error: "Missing token or file." }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ ok: false, error: "File exceeds 20 MB limit." }, { status: 400 });

    const supabase = serviceClient();

    const { data: session } = await supabase
      .from("client_portal_sessions")
      .select("venue_id, client_id")
      .eq("access_token", token)
      .maybeSingle<{ venue_id: string; client_id: string }>();

    if (!session) return NextResponse.json({ ok: false, error: "Invalid token." }, { status: 401 });

    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${session.venue_id}/${session.client_id}/messages/portal-${Date.now()}-${safe}`;

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: false, contentType: file.type });

    if (uploadErr) {
      console.error("[portal/messages/upload]", uploadErr.message);
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
