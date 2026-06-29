import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";
export async function POST(request: Request) {
  const { token, taskId } = await request.json() as { token: string; taskId: string };
  if (!token || !taskId) return NextResponse.json({ ok: false }, { status: 400 });
  const supabase = await createClient();
  const { data } = await supabase.rpc("complete_vendor_task", { p_token: token, p_task_id: taskId });
  return NextResponse.json(data ?? { ok: false });
}
