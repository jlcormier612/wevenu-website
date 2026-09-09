import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

/**
 * GET /api/portal/event-order — couple's read-only view of the last shared
 * Event Order snapshot (not live draft lines after venue reopen).
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
    line_is_included: boolean | null; line_unit: string | null;
    line_unit_price: number | null; line_notes: string | null;
  }>;
  if (rows.length === 0) return NextResponse.json({ eventOrder: null });

  const lines = rows
    .filter((r) => r.line_id != null)
    .map((r) => ({
      id: r.line_id!,
      description: r.line_description ?? "",
      quantity: r.line_quantity ?? 1,
      amount: r.line_amount ?? 0,
      sectionId: r.section_id,
      sectionName: r.section_name,
      isIncluded: r.line_is_included,
      unit: r.line_unit,
      unitPrice: r.line_unit_price,
      notes: r.line_notes,
    }));

  return NextResponse.json({
    eventOrder: {
      id: rows[0].id,
      status: rows[0].status,
      revision: rows[0].revision,
      sharedAt: rows[0].shared_at,
      lines,
    },
  });
}
