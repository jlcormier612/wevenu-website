import { NextResponse } from "next/server";

import { reconcilePaidCheckoutSession } from "@/lib/stripe/reconcile-paid-checkout";

/**
 * POST { session_id } — trusted Stripe re-read + idempotent enrollment when
 * Checkout success arrived before the webhook. Never grants access from the
 * URL alone; Stripe payment_status / subscription status are required.
 */
export async function POST(request: Request) {
  let body: { session_id?: string };
  try {
    body = (await request.json()) as { session_id?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const sessionId = body.session_id?.trim() || "";
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "missing_session_id" }, { status: 400 });
  }

  const result = await reconcilePaidCheckoutSession(sessionId);
  if (!result.ok) {
    return NextResponse.json(result, { status: 502 });
  }
  return NextResponse.json(result);
}
