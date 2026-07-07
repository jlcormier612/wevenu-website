import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_couple_unread_count");
  return NextResponse.json(data ?? { count: 0 });
}
