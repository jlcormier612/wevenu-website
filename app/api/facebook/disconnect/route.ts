import { NextResponse } from "next/server";

import { disconnectFacebookAccount } from "@/lib/facebook/service";

/** Stable disconnect endpoint — avoids stale Server Action IDs after ECS redeploys. */
export async function POST() {
  try {
    const result = await disconnectFacebookAccount();
    if (!result.ok) {
      return NextResponse.json({ ok: false, message: result.message ?? "Could not disconnect Facebook." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : "Could not disconnect Facebook." },
      { status: 500 },
    );
  }
}
