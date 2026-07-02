import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_venue_analytics");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if ((data as { error?: string })?.error) {
    return NextResponse.json({ error: (data as { error: string }).error }, { status: 401 });
  }
  return NextResponse.json(data);
}
