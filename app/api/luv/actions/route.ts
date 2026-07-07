import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

export async function POST(request: Request) {
  const { recommendationId, actionType } = (await request.json()) as {
    recommendationId: string;
    actionType:       string;
  };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_luv_action", {
    p_recommendation_id: recommendationId,
    p_action_type:       actionType,
  });

  if (error || !data) {
    return NextResponse.json({ error: "Failed to record action" }, { status: 500 });
  }

  return NextResponse.json({ id: data as string });
}
