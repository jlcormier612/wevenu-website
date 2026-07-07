import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { data, error } = await supabase.rpc("toggle_feature_vote", { p_feedback_id: id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data as { ok: boolean; voted: boolean });
}
