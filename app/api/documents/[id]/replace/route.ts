import { NextResponse } from "next/server";

import { createClient } from "@/integrations/supabase/server";
import { replaceDocumentFile } from "@/lib/documents/service";
import { getCurrentVenue } from "@/lib/venue/service";

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const venue = await getCurrentVenue();
  if (!venue) return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ ok: false, message: "Missing file." }, { status: 400 });
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, message: "File too large. Maximum 25 MB." }, { status: 400 });
  }

  const supabase = await createClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const storagePath = `${venue.id}/replacements/${id}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, file, { upsert: false, contentType: file.type || "application/octet-stream" });
  if (uploadError) {
    return NextResponse.json({ ok: false, message: uploadError.message }, { status: 400 });
  }

  const { data: urlData } = supabase.storage.from("documents").getPublicUrl(storagePath);
  const result = await replaceDocumentFile({
    documentId: id,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
    storagePath,
    storageUrl: urlData.publicUrl,
  });

  if (!result.ok) {
    await supabase.storage.from("documents").remove([storagePath]);
    return NextResponse.json({ ok: false, message: result.message ?? "Could not replace file." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, documentId: result.documentId, version: result.version });
}
