import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/env";
import {
  clientRequestMeta,
  getCouplePortalLegalGateStatus,
  recordCouplePortalLegalAcceptances,
  resolveCouplePortalLegalIdentity,
} from "@/lib/legal/service";

export const runtime = "nodejs";

/**
 * GET /api/portal/legal?token=...
 * Whether the couple portal identity still needs Welcome + legal acceptance.
 */
export async function GET(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Legal documents are unavailable." },
      { status: 503 },
    );
  }

  const token = new URL(request.url).searchParams.get("token")?.trim() || "";
  if (!token) {
    return NextResponse.json({ error: "Missing token." }, { status: 400 });
  }

  try {
    const identity = await resolveCouplePortalLegalIdentity(token);
    if (!identity) {
      return NextResponse.json({ error: "Invalid portal token." }, { status: 401 });
    }

    const status = await getCouplePortalLegalGateStatus(identity);
    return NextResponse.json({
      needsAcceptance: status.needsAcceptance,
      documents: status.documents,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load legal status.";
    console.error("[portal/legal] GET failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/portal/legal
 * Body: { token, legalAccepted: true }
 * Records couple End User Terms + Privacy acceptances (service role).
 */
export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Legal documents are unavailable." },
      { status: 503 },
    );
  }

  let body: { token?: string; legalAccepted?: unknown };
  try {
    body = (await request.json()) as { token?: string; legalAccepted?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const token = body.token?.trim() || "";
  if (!token) {
    return NextResponse.json({ error: "Missing token." }, { status: 400 });
  }

  const legalAccepted =
    body.legalAccepted === true ||
    body.legalAccepted === "true" ||
    body.legalAccepted === 1 ||
    body.legalAccepted === "1";
  if (!legalAccepted) {
    return NextResponse.json(
      {
        error:
          "Please agree to the End User Terms and Privacy Policy to continue.",
      },
      { status: 400 },
    );
  }

  try {
    const identity = await resolveCouplePortalLegalIdentity(token);
    if (!identity) {
      return NextResponse.json({ error: "Invalid portal token." }, { status: 401 });
    }
    if (!identity.userId && !identity.email) {
      return NextResponse.json(
        {
          error:
            "We could not identify your account email for legal acceptance. Ask your venue to update your contact email.",
        },
        { status: 400 },
      );
    }

    // Already current — idempotent success (do not insert duplicate rows).
    const current = await getCouplePortalLegalGateStatus(identity);
    if (!current.needsAcceptance) {
      return NextResponse.json({ ok: true, alreadyAccepted: true });
    }

    const { ipAddress, userAgent } = clientRequestMeta(request.headers);
    const acceptances = await recordCouplePortalLegalAcceptances({
      userId: identity.userId,
      email: identity.email,
      relationshipId: identity.relationshipId,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      ok: true,
      acceptanceIds: acceptances.map((a) => a.id),
      userId: acceptances[0]?.userId ?? null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to record acceptances.";
    console.error("[portal/legal] POST failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
