import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveImageFile } from "@/lib/storage";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing storage credentials.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/**
 * Couple relationship profile photo — upload, read, share, or remove.
 *
 * GET  ?token= → { photoUrl, shared }
 * POST multipart token+file → upload (sharing stays off unless already on)
 * PATCH { token, shared } → sharing toggle
 * DELETE { token } → remove photo
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ ok: false, error: "Missing token." }, { status: 400 });
  const supabase = getServiceClient();
  const { data, error } = await supabase.rpc("get_portal_relationship_photo", { p_token: token });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data ?? { ok: false });
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const token = form.get("token")?.toString();
    const file = form.get("file") as File | null;
    if (!token || !file) {
      return NextResponse.json({ ok: false, error: "Missing token or file." }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "File too large. Maximum 10MB." }, { status: 400 });
    }
    const resolved = resolveImageFile(file);
    if (!resolved) {
      return NextResponse.json({
        ok: false,
        error: "Only image files are accepted (JPG, PNG, GIF, WEBP, HEIC, and similar).",
      }, { status: 400 });
    }

    const supabase = getServiceClient();
    const { data: session } = await supabase
      .from("client_portal_sessions")
      .select("venue_id, client_id")
      .eq("access_token", token)
      .maybeSingle<{ venue_id: string; client_id: string }>();
    if (!session) {
      return NextResponse.json({ ok: false, error: "Invalid portal token." }, { status: 401 });
    }

    const { data: client } = await supabase
      .from("clients")
      .select("relationship_id")
      .eq("id", session.client_id)
      .maybeSingle<{ relationship_id: string | null }>();
    if (!client?.relationship_id) {
      return NextResponse.json({ ok: false, error: "No relationship." }, { status: 400 });
    }

    // Opaque object name so an unshared URL is not trivially guessed from IDs alone.
    const objectId = crypto.randomUUID();
    const path = `${session.venue_id}/relationships/${client.relationship_id}/profile-${objectId}.${resolved.ext}`;
    const { error: uploadError } = await supabase.storage
      .from("client-media")
      .upload(path, file, { upsert: false, contentType: file.type || resolved.mime });
    if (uploadError) {
      return NextResponse.json({ ok: false, error: "Upload failed. Please try again." }, { status: 500 });
    }
    const { data: urlData } = supabase.storage.from("client-media").getPublicUrl(path);
    const { data, error } = await supabase.rpc("set_portal_relationship_photo", {
      p_token: token,
      p_photo_url: urlData.publicUrl,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(data ?? { ok: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const body = await request.json() as { token?: string; shared?: boolean };
  if (!body.token || typeof body.shared !== "boolean") {
    return NextResponse.json({ ok: false, error: "Missing token or shared." }, { status: 400 });
  }
  const supabase = getServiceClient();
  const { data, error } = await supabase.rpc("set_portal_relationship_photo_sharing", {
    p_token: body.token,
    p_shared: body.shared,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data ?? { ok: false });
}

export async function DELETE(request: Request) {
  const body = await request.json() as { token?: string };
  if (!body.token) {
    return NextResponse.json({ ok: false, error: "Missing token." }, { status: 400 });
  }
  const supabase = getServiceClient();
  const { data, error } = await supabase.rpc("set_portal_relationship_photo", {
    p_token: body.token,
    p_photo_url: "",
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data ?? { ok: false });
}
