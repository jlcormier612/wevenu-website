import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { action } = (await request.json()) as { action: string };

  if (action !== "dismiss" && action !== "complete") {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_recommendation_status", {
    p_recommendation_id: id,
    p_action:            action,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const payload = data as { ok?: boolean } | null;
  if (payload?.ok !== true) {
    return NextResponse.json({ error: "recommendation not updated" }, { status: 409 });
  }
  revalidatePath("/dashboard");
  return NextResponse.json({ ok: true });
}
