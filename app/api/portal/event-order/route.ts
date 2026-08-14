import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

/**
 * GET /api/portal/event-order — the couple's read-only view of their
 * Event Order, resolved via their portal session token (same pattern as
 * /api/portal/inventory, D5A). get_event_order_for_portal() itself only
 * ever returns rows once the venue has explicitly shared (shared_at is
 * not null) — this route does no additional filtering.
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_event_order_for_portal", { p_token: token });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as Array<{
    id: string; status: string; revision: number; shared_at: string | null;
    section_id: string | null; section_name: string | null;
    line_id: string | null; line_description: string | null; line_quantity: number | null;
    line_amount: number | null; line_sort_order: number | null;
  }>;
  if (rows.length === 0) return NextResponse.json({ eventOrder: null });

  const lines = rows
    .filter((r) => r.line_id != null)
    .map((r) => ({
      id: r.line_id, description: r.line_description, quantity: r.line_quantity, amount: r.line_amount,
      sectionId: r.section_id, sectionName: r.section_name,
    }));

  return NextResponse.json({
    eventOrder: { id: rows[0].id, status: rows[0].status, revision: rows[0].revision, sharedAt: rows[0].shared_at, lines },
  });
}
