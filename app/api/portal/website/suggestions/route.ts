import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json(null);
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_website_suggestions", { p_token: token });
  return NextResponse.json(data ?? null);
}
