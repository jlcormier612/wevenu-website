import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

// Industry-standard suggested allocations as % of total budget
const SUGGESTED_ALLOCATIONS = [
  { key: "venue",          pct: 0.30, order: 0  },
  { key: "catering",       pct: 0.08, order: 1  },
  { key: "photography",    pct: 0.12, order: 2  },
  { key: "videography",    pct: 0.06, order: 3  },
  { key: "florist",        pct: 0.08, order: 4  },
  { key: "music",          pct: 0.05, order: 5  },
  { key: "hair_makeup",    pct: 0.03, order: 6  },
  { key: "officiant",      pct: 0.01, order: 7  },
  { key: "transportation", pct: 0.02, order: 8  },
  { key: "attire",         pct: 0.08, order: 9  },
  { key: "stationery",     pct: 0.02, order: 10 },
  { key: "cake",           pct: 0.02, order: 11 },
  { key: "favors",         pct: 0.02, order: 12 },
  { key: "misc",           pct: 0.05, order: 13 },
] as const;

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_portal_budget", { p_token: token });
  return NextResponse.json(data ?? { budget: null });
}

export async function POST(request: Request) {
  const body = await request.json() as {
    token: string;
    totalBudget: number;
    applySuggested?: boolean;
    contributors?: { id?: string; name: string; amount: number }[];
  };
  const { token, totalBudget, applySuggested, contributors } = body;

  if (!token || typeof totalBudget !== "number" || totalBudget < 0) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: budgetData, error: rpcError } = await supabase.rpc("upsert_portal_budget", {
    p_token: token,
    p_total_budget: totalBudget,
  });
  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }
  if (budgetData?.error) {
    return NextResponse.json({ error: budgetData.error }, { status: 400 });
  }

  if (contributors && Array.isArray(contributors)) {
    for (const c of contributors) {
      if (c.name?.trim() && typeof c.amount === "number") {
        await supabase.rpc("upsert_portal_contributor", {
          p_token: token,
          p_id: c.id ?? null,
          p_name: c.name.trim(),
          p_amount: c.amount,
        });
      }
    }
  }

  if (applySuggested) {
    for (const cat of SUGGESTED_ALLOCATIONS) {
      await supabase.rpc("upsert_portal_budget_category", {
        p_token: token,
        p_category_key: cat.key,
        p_budgeted: Math.round(totalBudget * cat.pct),
        p_actual: 0,
        p_display_order: cat.order,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
