import { NextResponse } from "next/server";

import { welcomeDocumentsFromOutstanding } from "@/components/welcome-experience/welcome-experience-helpers";
import { isSupabaseConfigured } from "@/lib/env";
import {
  clientRequestMeta,
  getCouplePortalLegalGateStatus,
  legalAcceptanceService,
  resolveCouplePortalLegalIdentity,
  resolveUserIdForEmail,
} from "@/lib/legal/service";
import {
  acceptanceMethodForContext,
  inferWelcomeContext,
  isWelcomeFlowContext,
  outstandingImpliesPriorAcceptance,
  recordOutstandingAcceptances,
  welcomeRequiresReview,
  type WelcomeFlowContext,
} from "@/lib/legal/welcome-integration";

export const runtime = "nodejs";

/**
 * GET /api/portal/legal?token=...
 * Whether the couple portal identity still needs Welcome + legal acceptance.
 * Prefers the Legal Acceptance Engine when a user id is available.
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

    if (identity.userId) {
      const engine = await legalAcceptanceService.requiresAcceptance({
        userId: identity.userId,
        userType: "couple",
        relationshipId: identity.relationshipId,
      });
      const docs = welcomeDocumentsFromOutstanding(engine.outstanding);
      return NextResponse.json({
        // Only reviewable (active) outstanding docs should mount Welcome.
        needsAcceptance: welcomeRequiresReview(engine.outstanding),
        hasPriorAcceptance: outstandingImpliesPriorAcceptance(
          engine.outstanding,
        ),
        documents: docs.map((d) => ({
          id: d.id ?? d.documentType ?? d.title,
          documentType: d.documentType ?? "couple_end_user_terms",
          title: d.title,
          version: d.version,
          path: d.viewHref,
        })),
      });
    }

    const status = await getCouplePortalLegalGateStatus(identity);
    return NextResponse.json({
      needsAcceptance: status.needsAcceptance,
      hasPriorAcceptance: false,
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
 * Body: { token, legalAccepted: true, context?: WelcomeFlowContext }
 * Records outstanding couple docs via the Legal Acceptance Engine (idempotent).
 */
export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Legal documents are unavailable." },
      { status: 503 },
    );
  }

  let body: { token?: string; legalAccepted?: unknown; context?: unknown };
  try {
    body = (await request.json()) as {
      token?: string;
      legalAccepted?: unknown;
      context?: unknown;
    };
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

    // Prefer email → auth.users resolve/create so portal sessions without a
    // verified auth id (or with a stale client_user_id) still record against a
    // real FK target. Fall back to session user id when email is unavailable.
    let userId: string | null = null;
    if (identity.email) {
      try {
        userId = await resolveUserIdForEmail(identity.email);
      } catch (error) {
        console.error("[portal/legal] resolveUserIdForEmail failed", error);
      }
    }
    if (!userId) {
      userId = identity.userId?.trim() || null;
    }
    if (!userId) {
      return NextResponse.json(
        { error: "Unable to resolve user for legal acceptance." },
        { status: 400 },
      );
    }

    const user = {
      userId,
      userType: "couple" as const,
      relationshipId: identity.relationshipId,
    };

    const status = await legalAcceptanceService.requiresAcceptance(user);
    if (!welcomeRequiresReview(status.outstanding)) {
      return NextResponse.json({ ok: true, alreadyAccepted: true, userId });
    }

    const hasPrior = outstandingImpliesPriorAcceptance(status.outstanding);
    const contextParam =
      typeof body.context === "string" ? body.context : null;
    const context: WelcomeFlowContext = isWelcomeFlowContext(contextParam)
      ? contextParam
      : inferWelcomeContext({
          userType: "couple",
          hasPriorAcceptance: hasPrior,
        });

    const { ipAddress, userAgent } = clientRequestMeta(request.headers);
    const result = await recordOutstandingAcceptances({
      user,
      outstanding: status.outstanding,
      acceptanceMethod: acceptanceMethodForContext(context),
      ipAddress,
      userAgent,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      userId,
      recorded: result.recorded,
      alreadyAcceptedCount: result.alreadyAccepted,
      context,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to record acceptances.";
    console.error("[portal/legal] POST failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
