import { NextRequest, NextResponse } from "next/server";

import { markVendorNotificationsRead } from "@/lib/vendor-notifications/service";
import { getVendorUser } from "@/lib/vendor-auth/service";

export async function POST(req: NextRequest) {
  const vendorUser = await getVendorUser();
  if (!vendorUser) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json() as { ids?: string[] };
  const result = await markVendorNotificationsRead(body.ids ?? []);
  return NextResponse.json(result);
}
