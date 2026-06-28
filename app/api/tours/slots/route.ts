import { NextResponse } from "next/server";
import { getTourSlots } from "@/lib/tours/service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key   = searchParams.get("key") ?? "";
  const start = searchParams.get("start") ?? "";
  const end   = searchParams.get("end") ?? "";
  if (!key || !start || !end) return NextResponse.json({ slots: [] });
  const slots = await getTourSlots(key, start, end);
  return NextResponse.json({ slots });
}
