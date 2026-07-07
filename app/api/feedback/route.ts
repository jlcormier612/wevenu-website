import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";
import { sendFeedbackEmail } from "@/lib/feedback/notify";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type, subject, body, rating, metadata: clientMeta } = await req.json() as {
    type: string; subject?: string; body?: string; rating?: number;
    metadata?: { current_url?: string; user_agent?: string };
  };

  if (!type) return NextResponse.json({ error: "Missing type" }, { status: 400 });

  // Resolve venue + days since signup
  const { data: vu } = await supabase
    .from("venue_users")
    .select("venue_id, venues(name, created_at)")
    .eq("user_id", user.id)
    .maybeSingle<{ venue_id: string; venues: { name: string; created_at: string } | null }>();

  if (!vu) return NextResponse.json({ error: "No venue" }, { status: 400 });

  const daysSinceSignup = vu.venues?.created_at
    ? Math.floor((Date.now() - new Date(vu.venues.created_at).getTime()) / 86_400_000)
    : null;

  const metadata = {
    current_url:        clientMeta?.current_url ?? null,
    user_agent:         clientMeta?.user_agent  ?? null,
    subscription_tier:  null,   // populated once billing is live
    days_since_signup:  daysSinceSignup,
    venue_name:         vu.venues?.name ?? null,
    user_email:         user.email ?? null,
  };

  const { error } = await supabase.from("venue_feedback").insert({
    venue_id: vu.venue_id,
    user_id:  user.id,
    type,
    subject:  subject?.trim() || null,
    body:     body?.trim() ?? "",
    rating:   rating ?? null,
    metadata,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  void sendFeedbackEmail({
    type,
    subject:   subject?.trim() ?? null,
    body:      body?.trim() ?? "",
    rating:    rating ?? null,
    userEmail: user.email ?? "unknown",
    venueName: vu.venues?.name ?? "Unknown venue",
    metadata,
  });

  return NextResponse.json({ ok: true });
}
