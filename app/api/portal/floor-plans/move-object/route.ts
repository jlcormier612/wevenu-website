import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

/**
 * Portal: move an unlocked object on the shared working plan.
 * Rejects locked objects, Ready plans, and unauthorized tokens.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    token?: string;
    objectId?: string;
    x?: number;
    y?: number;
  } | null;
  const token = body?.token?.trim() ?? "";
  const objectId = body?.objectId?.trim() ?? "";
  const x = body?.x;
  const y = body?.y;
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });
  if (!objectId) return NextResponse.json({ error: "missing_object_id" }, { status: 400 });
  if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) {
    return NextResponse.json({ error: "invalid_coordinates" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("move_portal_floor_plan_object", {
    p_token: token,
    p_object_id: objectId,
    p_x: x,
    p_y: y,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    const code = result?.error ?? "move_failed";
    const status =
      code === "object_locked" || code === "plan_ready" || code === "add_not_permitted" ? 403
        : code === "not_found" || code === "not_shared" ? 404
          : code === "insufficient_access" || code === "invalid_token" ? 403
            : 400;
    return NextResponse.json({ error: code }, { status });
  }
  return NextResponse.json(result);
}
