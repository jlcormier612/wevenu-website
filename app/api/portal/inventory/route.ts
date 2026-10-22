import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

/**
 * GET /api/portal/inventory — couple view of Event Inventory via portal token.
 * Visibility is enforced by get_event_inventory_for_portal (shared / submitted /
 * changes_requested / confirmed / finalized). When collaboration_mode=select and
 * status is shared|changes_requested, the couple may draft/submit quantities via
 * /api/portal/inventory/save and /submit — never by mutating prices or inclusion.
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_event_inventory_for_portal", { p_token: token });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as Array<{
    id: string;
    status: string;
    finalized_at: string | null;
    collaboration_mode?: string | null;
    item_id: string | null;
    item_name: string | null;
    item_category: string | null;
    item_quantity: number | null;
    item_unit_price: number | null;
    item_is_included: boolean | null;
    item_notes: string | null;
    item_sort_order: number | null;
    item_client_selectable?: boolean | null;
    item_max_quantity?: number | null;
    item_client_draft_quantity?: number | null;
    item_client_submitted_quantity?: number | null;
  }>;
  if (rows.length === 0) return NextResponse.json({ inventory: null });

  const items = rows
    .filter((r) => r.item_id != null)
    .map((r) => ({
      id: r.item_id as string,
      name: r.item_name,
      category: r.item_category,
      quantity: r.item_quantity,
      unitPrice: r.item_unit_price,
      isIncluded: r.item_is_included,
      notes: r.item_notes,
      clientSelectable: !!r.item_client_selectable,
      maxQuantity: r.item_max_quantity == null ? null : Number(r.item_max_quantity),
      clientDraftQuantity:
        r.item_client_draft_quantity == null ? null : Number(r.item_client_draft_quantity),
      clientSubmittedQuantity:
        r.item_client_submitted_quantity == null ? null : Number(r.item_client_submitted_quantity),
    }));

  return NextResponse.json({
    inventory: {
      id: rows[0].id,
      status: rows[0].status,
      finalizedAt: rows[0].finalized_at,
      collaborationMode: rows[0].collaboration_mode === "select" ? "select" : "view",
      items,
    },
  });
}
