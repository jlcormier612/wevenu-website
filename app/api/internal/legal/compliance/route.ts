import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/env";
import {
  getLegalComplianceSummary,
  isLegalComplianceSubject,
} from "@/lib/legal/service";

export const runtime = "nodejs";

/**
 * Internal: read-only legal compliance summary for Relationship Workspace.
 *
 * Auth: Bearer PRODUCT_SYNC_API_KEY
 *
 * Query:
 *   subject=venue|couple|vendor (default venue)
 *   relationshipId?
 *   email?
 *   userId?
 */
function authorize(request: Request): boolean {
  const expected = process.env.PRODUCT_SYNC_API_KEY?.trim();
  if (!expected) return false;
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  return Boolean(token && token === expected);
}

export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const subjectRaw = url.searchParams.get("subject")?.trim() || "venue";
  if (!isLegalComplianceSubject(subjectRaw)) {
    return NextResponse.json(
      { error: "subject must be venue, couple, or vendor." },
      { status: 400 },
    );
  }

  const relationshipId = url.searchParams.get("relationshipId");
  const email = url.searchParams.get("email");
  const userId = url.searchParams.get("userId");

  if (!relationshipId?.trim() && !email?.trim() && !userId?.trim()) {
    return NextResponse.json(
      { error: "relationshipId, email, or userId is required." },
      { status: 400 },
    );
  }

  try {
    const summary = await getLegalComplianceSummary({
      subject: subjectRaw,
      relationshipId,
      email,
      userId,
    });
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load legal compliance.";
    console.error("[legal] compliance summary failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
