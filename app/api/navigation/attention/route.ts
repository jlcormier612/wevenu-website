import { NextResponse } from "next/server";

import { getNavAttentionCounts } from "@/lib/navigation/attention-service";

export async function GET() {
  const counts = await getNavAttentionCounts();
  return NextResponse.json(counts);
}
