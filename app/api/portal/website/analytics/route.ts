import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ totalViews: 0, weekViews: 0 });
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_website_analytics", { p_token: token });
  return NextResponse.json(data ?? { totalViews: 0, weekViews: 0 });
}
