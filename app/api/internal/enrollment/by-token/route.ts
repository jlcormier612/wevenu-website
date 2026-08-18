import { NextResponse } from "next/server";

import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";

export const runtime = "nodejs";

/** Mirrors shared/relationships/lifecycle.ts's ACTIVATION_TOKEN_TTL_MS. */
const ACTIVATION_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30;

/**
 * Internal workspace/ -> product enrollment lookup by activation token,
 * read-only.
 *
 * Auth: Bearer PRODUCT_SYNC_API_KEY
 *
 * Backs workspace/app/activate/[token]/page.tsx's initial token-validity
 * check. Previously that page read shared/relationships' local JSON-file
 * store (lookupActivationToken) — a per-container filesystem with no
 * volume shared between the marketing and workspace ECS services, so a
 * token minted by marketing's checkout.session.completed handler could
 * never be found there, and the directory-create it attempted on every
 * request failed outright (EACCES on the container's read-only/unwritable
 * /app). This endpoint reads the same real venue_enrollments row that
 * /api/internal/enrollment/activate already activates against, so the
 * page's read and the form's write are finally looking at the same data.
 *
 * Body: { activationToken }
 */
type LookupBody = {
  activationToken?: string;
};

export type ByTokenLookupResult =
  | { ok: true; found: false }
  | {
      ok: true;
      found: true;
      reason: "already_activated" | "expired";
    }
  | {
      ok: true;
      found: true;
      reason: "valid";
      id: string;
      venueName: string;
      ownerEmail: string;
    }
  | { ok: false; error: string };

function authorize(request: Request): boolean {
  const expected = process.env.PRODUCT_SYNC_API_KEY?.trim();
  if (!expected) return false;
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  return Boolean(token && token === expected);
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Supabase is not configured in this environment." },
      { status: 503 },
    );
  }

  let body: LookupBody;
  try {
    body = (await request.json()) as LookupBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const token = body.activationToken?.trim();
  if (!token) {
    return NextResponse.json({ ok: true, found: false } satisfies ByTokenLookupResult);
  }

  const admin = createAdminClient();

  try {
    const { data: enrollment, error } = await admin
      .from("venue_enrollments")
      .select("id, venue_name, owner_email, status, activation_token_created_at")
      .eq("activation_token", token)
      .maybeSingle();
    if (error) throw error;

    if (!enrollment) {
      return NextResponse.json({ ok: true, found: false } satisfies ByTokenLookupResult);
    }

    if (enrollment.status === "activated") {
      return NextResponse.json({
        ok: true,
        found: true,
        reason: "already_activated",
      } satisfies ByTokenLookupResult);
    }

    const createdAt = enrollment.activation_token_created_at as string | null;
    const isExpired =
      Boolean(createdAt) && Date.now() - new Date(createdAt as string).getTime() > ACTIVATION_TOKEN_TTL_MS;
    if (isExpired) {
      return NextResponse.json({
        ok: true,
        found: true,
        reason: "expired",
      } satisfies ByTokenLookupResult);
    }

    return NextResponse.json({
      ok: true,
      found: true,
      reason: "valid",
      id: enrollment.id as string,
      venueName: (enrollment.venue_name as string) || "your venue",
      ownerEmail: (enrollment.owner_email as string) || "",
    } satisfies ByTokenLookupResult);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[enrollment/by-token]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
