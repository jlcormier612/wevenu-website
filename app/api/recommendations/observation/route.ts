import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";
import { isLuvMasterEnabledForCurrentVenue } from "@/lib/luv/settings";

export async function PATCH(request: Request) {
  if (!(await isLuvMasterEnabledForCurrentVenue())) {
    return NextResponse.json({ error: "Luv is turned off in Settings." }, { status: 403 });
  }

  const body = (await request.json()) as { action?: string; observationId?: string };
  if (body.action !== "dismiss" || typeof body.observationId !== "string") {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dismiss_luv_dashboard_observation", {
    p_observation_id: body.observationId,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const payload = data as { ok?: boolean } | null;
  if (payload?.ok !== true) {
    return NextResponse.json({ error: "observation not updated" }, { status: 409 });
  }
  revalidatePath("/dashboard");
  return NextResponse.json({ ok: true });
}
