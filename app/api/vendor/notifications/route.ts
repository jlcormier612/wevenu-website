import { NextResponse } from "next/server";

import { getVendorNotifications } from "@/lib/vendor-notifications/service";
import { getVendorUser } from "@/lib/vendor-auth/service";

export async function GET() {
  const vendorUser = await getVendorUser();
  if (!vendorUser) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await getVendorNotifications();
  return NextResponse.json(result);
}
