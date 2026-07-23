/**
 * POST /api/portal/checkout
 * body: { token, itemId }
 *
 * Creates a Stripe Hosted Checkout Session for one payment_line_item and
 * returns the URL to redirect the couple to. Sprint 4 — Venue Payment
 * Processing.
 */
import { NextResponse } from "next/server";
import { createPortalCheckoutSession } from "@/lib/stripe/checkout";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { token?: string; itemId?: string } | null;
  const token = body?.token ?? "";
  const itemId = body?.itemId ?? "";
  if (!token || !itemId) return NextResponse.json({ error: "missing_params" }, { status: 400 });

  const result = await createPortalCheckoutSession(token, itemId);
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 });
  return NextResponse.json({ checkoutUrl: result.checkoutUrl });
}
