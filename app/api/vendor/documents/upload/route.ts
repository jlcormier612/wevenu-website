/**
 * POST /api/vendor/documents/upload
 *
 * Vendor library / one-off event document upload. Mirrors
 * /api/vendor/conversations/upload — service-role storage write after
 * verifying the caller is an active vendor user. Files land in the
 * `vendors` bucket (already public-read + authenticated insert).
 */
import { NextResponse } from "next/server";
import { createClient as createAuthClient } from "@/integrations/supabase/server";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "vendors";
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
    const scope = (form.get("scope")?.toString() || "library") as
      | "library"
      | "event"
      | "task-template";
    const eventId = form.get("eventId")?.toString();

    if (!file) return NextResponse.json({ ok: false, error: "No file." }, { status: 400 });
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ ok: false, error: "File exceeds 20 MB limit." }, { status: 400 });
    }

    const auth = await createAuthClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });

    const { data: vendorUser } = await auth
      .from("vendor_users")
      .select("vendor_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle<{ vendor_id: string }>();

    if (!vendorUser?.vendor_id) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }

    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const ext = safe.includes(".") ? safe.split(".").pop() : "bin";
    const id = crypto.randomUUID();
    const path =
      scope === "event" && eventId
        ? `${vendorUser.vendor_id}/events/${eventId}/${id}.${ext}`
        : scope === "task-template"
          ? `${vendorUser.vendor_id}/task-templates/${id}.${ext}`
          : `${vendorUser.vendor_id}/library/${id}.${ext}`;

    const supabase = serviceClient();
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: false, contentType: file.type });

    if (uploadErr) {
      console.error("[vendor/documents/upload]", uploadErr.message);
      return NextResponse.json({ ok: false, error: "Upload failed." }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

    return NextResponse.json({
      ok: true,
      storagePath: path,
      storageUrl: urlData.publicUrl,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
