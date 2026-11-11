import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

/**
 * POST /api/portal/event-order/accept
 * Client accepts the shared Event Order. Share alone is not agreement.
 */
export async function POST(request: Request) {
  let body: { token?: string; agreedName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }
  const token = typeof body.token === "string" ? body.token : "";
  const agreedName = typeof body.agreedName === "string" ? body.agreedName : "";
  if (!token) {
    return NextResponse.json({ ok: false, message: "missing_token" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_event_order_for_portal", {
    p_token: token,
    p_agreed_name: agreedName,
  });
  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
  const result = (data ?? {}) as {
    ok?: boolean;
    message?: string;
    already?: boolean;
    client_agreed_at?: string;
    client_agreed_revision?: number;
  };
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, message: result.message ?? "Could not accept Event Order." },
      { status: 400 },
    );
  }
  return NextResponse.json({
    ok: true,
    already: Boolean(result.already),
    clientAgreedAt: result.client_agreed_at ?? null,
    clientAgreedRevision: result.client_agreed_revision ?? null,
  });
}
