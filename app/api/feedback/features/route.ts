import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

type FeatureRow = {
  id: string;
  subject: string | null;
  body: string;
  status: string;
  vote_count: number;
  i_voted: boolean;
  created_at: string;
};

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase.rpc("get_public_feature_requests");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ features: (data ?? []) as FeatureRow[] });
}
