import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

/**
 * GET /api/portal/inventory — the couple's read-only view of their Event
 * Inventory, resolved via their portal session token (same shape as
 * /api/portal/questionnaire). Only ever returns rows the venue has
 * explicitly shared or finalized — get_event_inventory_for_portal()
 * (20261248000000_event_inventory_foundation.sql) itself enforces that,
 * this route does no additional filtering. D5A judgment call: read-only —
 * the client sees what's included/what costs extra, but does not edit
 * (no existing product precedent for client-editable structured data
 * outside Guest Count Submission and the Questionnaire).
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_event_inventory_for_portal", { p_token: token });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as Array<{
    id: string; status: string; finalized_at: string | null;
    item_id: string | null; item_name: string | null; item_category: string | null;
    item_quantity: number | null; item_unit_price: number | null; item_is_included: boolean | null;
    item_notes: string | null; item_sort_order: number | null;
  }>;
  if (rows.length === 0) return NextResponse.json({ inventory: null });

  const items = rows
    .filter((r) => r.item_id != null)
    .map((r) => ({
      id: r.item_id, name: r.item_name, category: r.item_category, quantity: r.item_quantity,
      unitPrice: r.item_unit_price, isIncluded: r.item_is_included, notes: r.item_notes,
    }));

  return NextResponse.json({
    inventory: { id: rows[0].id, status: rows[0].status, finalizedAt: rows[0].finalized_at, items },
  });
}
