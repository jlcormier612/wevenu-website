import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

export async function POST(request: Request) {
  const body = await request.json() as {
    token: string;
    categoryKey: string;
    budgetedAmount: number;
    actualAmount: number;
    displayOrder?: number;
  };
  const { token, categoryKey, budgetedAmount, actualAmount, displayOrder } = body;

  if (!token || !categoryKey) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data } = await supabase.rpc("upsert_portal_budget_category", {
    p_token: token,
    p_category_key: categoryKey,
    p_budgeted: budgetedAmount ?? 0,
    p_actual: actualAmount ?? 0,
    p_display_order: displayOrder ?? 0,
  });

  if (data?.error) return NextResponse.json({ error: data.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
