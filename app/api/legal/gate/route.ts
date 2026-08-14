import { NextResponse } from "next/server";

import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  clientRequestMeta,
  getLegalGateStatus,
  legalTypesForPortal,
  recordActiveLegalAcceptancesForTypes,
} from "@/lib/legal/service";
import type { AuthenticatedLegalPortal } from "@/lib/legal/types";

export const runtime = "nodejs";

function parsePortal(value: unknown): AuthenticatedLegalPortal | null {
  if (value === "venue" || value === "vendor") return value;
  return null;
}

/**
 * GET /api/legal/gate?portal=venue|vendor
 * Version comparison for the signed-in user against active required docs.
 */
export async function GET(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Legal documents are unavailable." },
      { status: 503 },
    );
  }

  const portal = parsePortal(
    new URL(request.url).searchParams.get("portal")?.trim(),
  );
  if (!portal) {
    return NextResponse.json(
      { error: "portal must be venue or vendor." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const status = await getLegalGateStatus(user.id, legalTypesForPortal(portal));
    return NextResponse.json({
      needsAcceptance: status.needsAcceptance,
      documents: status.documents,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load legal status.";
    console.error("[legal/gate] GET failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/legal/gate
 * Body: { portal: "venue" | "vendor", legalAccepted: true }
 * Append-only inserts for currently active required document versions.
 */
export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Legal documents are unavailable." },
      { status: 503 },
    );
  }

  let body: { portal?: unknown; legalAccepted?: unknown };
  try {
    body = (await request.json()) as {
      portal?: unknown;
      legalAccepted?: unknown;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const portal = parsePortal(body.portal);
  if (!portal) {
    return NextResponse.json(
      { error: "portal must be venue or vendor." },
      { status: 400 },
    );
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
          "Please agree to the required terms and Privacy Policy to continue.",
      },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const documentTypes = legalTypesForPortal(portal);

  try {
    const current = await getLegalGateStatus(user.id, documentTypes);
    if (!current.needsAcceptance) {
      return NextResponse.json({ ok: true, alreadyAccepted: true });
    }

    const { ipAddress, userAgent } = clientRequestMeta(request.headers);
    const acceptances = await recordActiveLegalAcceptancesForTypes({
      userId: user.id,
      documentTypes,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      ok: true,
      acceptanceIds: acceptances.map((a) => a.id),
      userId: user.id,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to record acceptances.";
    console.error("[legal/gate] POST failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
