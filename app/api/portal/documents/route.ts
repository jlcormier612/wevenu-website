import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_couple_documents", { p_token: token });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? { documents: [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { token, name, fileUrl, fileSize, mimeType, shareWithVenue, sourceType } = body;
  if (!token || !name || !fileUrl)
    return NextResponse.json({ error: "missing_params" }, { status: 400 });

  const supabase = await createClient();

  // Resolve client_id from portal token
  const { data: ids } = await supabase.rpc("_resolve_portal_ids", { p_token: token });
  if (!ids?.client_id)
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });

  const { data, error } = await supabase
    .from("couple_documents")
    .insert({
      client_id:        ids.client_id,
      name,
      file_url:         fileUrl,
      file_size:        fileSize ?? null,
      mime_type:        mimeType ?? null,
      uploaded_by:      "couple",
      share_with_venue: shareWithVenue ?? false,
      source_type:      sourceType ?? "upload",
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
