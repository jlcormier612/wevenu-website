import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";
import { isLuvMasterEnabledForCurrentVenue } from "@/lib/luv/settings";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isLuvMasterEnabledForCurrentVenue())) {
    return NextResponse.json({ error: "Luv is turned off in Settings." }, { status: 403 });
  }

  const { id }     = await params;
  const { action } = (await request.json()) as { action: "complete" | "dismiss" };

  const supabase = await createClient();

  if (action === "complete") {
    await supabase.rpc("complete_luv_action", { p_action_id: id });
  }

  return NextResponse.json({ ok: true });
}
