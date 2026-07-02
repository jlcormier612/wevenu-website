import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_venue_notifications");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = data as {
    notifications?: unknown[];
    unreadCount?: number;
    error?: string;
  } | null;

  if (result?.error) return NextResponse.json({ error: result.error }, { status: 401 });

  return NextResponse.json({
    notifications: result?.notifications ?? [],
    unreadCount:   result?.unreadCount   ?? 0,
  });
}
