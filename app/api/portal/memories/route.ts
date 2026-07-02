import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_couple_memories", { p_token: token });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const result = data as { memories?: unknown[]; error?: string } | null;
  if (result?.error) return NextResponse.json({ error: result.error }, { status: 401 });

  return NextResponse.json({ memories: result?.memories ?? [] });
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    token?: string;
    storagePath?: string;
    storageUrl?: string;
    caption?: string;
    visibility?: string;
  };

  const { token, storagePath, storageUrl, caption, visibility } = body;

  if (!token || !storagePath || !storageUrl) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_couple_memory", {
    p_token:        token,
    p_storage_path: storagePath,
    p_storage_url:  storageUrl,
    p_caption:      caption    ?? "",
    p_visibility:   visibility ?? "private",
  });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const result = data as { ok: boolean; memory?: unknown; error?: string } | null;

  if (!result?.ok) {
    return NextResponse.json({ ok: false, error: result?.error ?? "unknown" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, memory: result.memory });
}
