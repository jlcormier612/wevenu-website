import { NextResponse } from "next/server";

import { redeemSmsConsentEmailToken } from "@/lib/communication/sms-consent-email";

export async function POST(request: Request) {
  let body: { token?: string; optedIn?: boolean };
  try {
    body = (await request.json()) as { token?: string; optedIn?: boolean };
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }
  const result = await redeemSmsConsentEmailToken(body.token ?? "", Boolean(body.optedIn));
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}
