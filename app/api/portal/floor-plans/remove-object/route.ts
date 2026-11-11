import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

/**
 * Portal: remove an unlocked seatable table. Requires confirmUnassign when guests
 * are assigned (server returns has_assignments otherwise).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    token?: string;
    objectId?: string;
    confirmUnassign?: boolean;
  } | null;
  const token = body?.token?.trim() ?? "";
  const objectId = body?.objectId?.trim() ?? "";
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });
  if (!objectId) return NextResponse.json({ error: "missing_object_id" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("remove_portal_floor_plan_object", {
    p_token: token,
    p_object_id: objectId,
    p_confirm_unassign: Boolean(body?.confirmUnassign),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const result = data as { ok?: boolean; error?: string; assignedCount?: number } | null;
  if (!result?.ok) {
    const code = result?.error ?? "remove_failed";
    const status =
      code === "object_locked" || code === "plan_ready" || code === "type_not_removable" ? 403
        : code === "has_assignments" ? 409
          : code === "not_shared" || code === "not_found" ? 404
            : code === "insufficient_access" || code === "invalid_token" ? 403
              : 400;
    return NextResponse.json(
      { error: code, assignedCount: result?.assignedCount },
      { status },
    );
  }
  return NextResponse.json(result);
}
