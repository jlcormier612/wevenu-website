import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

async function requireHqAdmin(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: isAdmin } = await supabase.rpc("is_hq_admin");
  return !!isAdmin;
}

export async function GET() {
  const supabase = await createClient();

  if (!(await requireHqAdmin(supabase))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("venue_feedback")
    .select(`
      id, type, subject, body, rating, status, metadata, created_at,
      venues(name),
      vote_count:venue_feedback_votes(count)
    `)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Flatten vote_count from nested aggregate
  const feedback = (data ?? []).map(r => ({
    ...r,
    vote_count: Array.isArray(r.vote_count) ? (r.vote_count[0] as { count: number } | undefined)?.count ?? 0 : 0,
  }));

  return NextResponse.json({ feedback });
}

export async function PATCH(req: Request) {
  const supabase = await createClient();

  if (!(await requireHqAdmin(supabase))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, status } = await req.json() as { id: string; status: string };
  const { error } = await supabase
    .from("venue_feedback")
    .update({ status })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
