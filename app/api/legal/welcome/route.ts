import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/env";
import {
  clientRequestMeta,
  legalAcceptanceService,
} from "@/lib/legal/service";
import { resolveLegalSessionPrincipal } from "@/lib/legal/resolve-session-principal";
import { createClient } from "@/integrations/supabase/server";
import {
  acceptanceMethodForContext,
  copyForWelcomeContext,
  inferWelcomeContext,
  isWelcomeFlowContext,
  outstandingImpliesPriorAcceptance,
  recordOutstandingAcceptances,
  safeReturnToPath,
  type WelcomeFlowContext,
} from "@/lib/legal/welcome-integration";
import { welcomeDocumentsFromOutstanding } from "@/components/welcome-experience/welcome-experience-helpers";

export const runtime = "nodejs";

/**
 * GET /api/legal/welcome?context=&returnTo=
 * Outstanding docs + copy for the signed-in session principal.
 */
export async function GET(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Legal documents are unavailable." },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const contextParam = url.searchParams.get("context");
  const pathnameHint = url.searchParams.get("pathname");

  try {
    const principal = await resolveLegalSessionPrincipal(user.id);
    if (!principal) {
      return NextResponse.json(
        { error: "Unable to resolve account type." },
        { status: 500 },
      );
    }

    const status = await legalAcceptanceService.requiresAcceptance(
      principal.user,
    );
    const hasPrior = outstandingImpliesPriorAcceptance(status.outstanding);
    const context: WelcomeFlowContext = isWelcomeFlowContext(contextParam)
      ? contextParam
      : inferWelcomeContext({
          userType: principal.user.userType,
          pathname: pathnameHint,
          hasPriorAcceptance: hasPrior,
        });

    const copy = copyForWelcomeContext(context);
    const documents = welcomeDocumentsFromOutstanding(status.outstanding);
    const returnTo = safeReturnToPath(url.searchParams.get("returnTo"), {
      fallback:
        principal.kind === "vendor" ? "/vendor/dashboard" : "/dashboard",
      origin: url.origin,
    });

    return NextResponse.json({
      ok: true,
      requiresAcceptance: status.requiresAcceptance,
      context,
      heading: copy.heading,
      introduction: copy.introduction,
      documents,
      returnTo,
      userType: principal.user.userType,
      acceptanceMethod: acceptanceMethodForContext(context),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load welcome status.";
    console.error("[legal/welcome] GET failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/legal/welcome
 * Body: { legalAccepted: true, context?: WelcomeFlowContext }
 * Records outstanding acceptances via the engine (idempotent).
 */
export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Legal documents are unavailable." },
      { status: 503 },
    );
  }

  let body: {
    legalAccepted?: unknown;
    context?: unknown;
    returnTo?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const legalAccepted =
    body.legalAccepted === true ||
    body.legalAccepted === "true" ||
    body.legalAccepted === 1 ||
    body.legalAccepted === "1";
  if (!legalAccepted) {
    return NextResponse.json(
      {
        error: "Please agree to the required documents to continue.",
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

  try {
    const principal = await resolveLegalSessionPrincipal(user.id);
    if (!principal) {
      return NextResponse.json(
        { error: "Unable to resolve account type." },
        { status: 500 },
      );
    }

    const status = await legalAcceptanceService.requiresAcceptance(
      principal.user,
    );

    if (!status.requiresAcceptance) {
      return NextResponse.json({
        ok: true,
        alreadyAccepted: true,
        recorded: 0,
        alreadyAcceptedCount: 0,
      });
    }

    const hasPrior = outstandingImpliesPriorAcceptance(status.outstanding);
    const contextParam =
      typeof body.context === "string" ? body.context : null;
    const context: WelcomeFlowContext = isWelcomeFlowContext(contextParam)
      ? contextParam
      : inferWelcomeContext({
          userType: principal.user.userType,
          hasPriorAcceptance: hasPrior,
        });

    const { ipAddress, userAgent } = clientRequestMeta(request.headers);
    const result = await recordOutstandingAcceptances({
      user: principal.user,
      outstanding: status.outstanding,
      acceptanceMethod: acceptanceMethodForContext(context),
      ipAddress,
      userAgent,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    const returnTo = safeReturnToPath(
      typeof body.returnTo === "string" ? body.returnTo : null,
      {
        fallback:
          principal.kind === "vendor" ? "/vendor/dashboard" : "/dashboard",
      },
    );

    return NextResponse.json({
      ok: true,
      recorded: result.recorded,
      alreadyAcceptedCount: result.alreadyAccepted,
      returnTo,
      context,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to record acceptances.";
    console.error("[legal/welcome] POST failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
