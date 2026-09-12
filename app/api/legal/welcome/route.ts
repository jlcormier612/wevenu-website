import { NextResponse } from "next/server";

import { welcomeDocumentsFromOutstanding } from "@/components/welcome-experience/welcome-experience-helpers";
import {
  createClient,
  createVendorClient,
} from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  clientRequestMeta,
  legalAcceptanceService,
} from "@/lib/legal/service";
import { resolveLegalSessionPrincipal } from "@/lib/legal/resolve-session-principal";
import {
  acceptanceMethodForContext,
  copyForWelcomeContext,
  inferWelcomeContext,
  outstandingImpliesPriorAcceptance,
  recordOutstandingAcceptances,
  welcomeRequiresReview,
  type WelcomeFlowContext,
} from "@/lib/legal/welcome-integration";
import {
  resolveWelcomeAuthScope,
  safeWelcomeReturnToPath,
  welcomeContextForScope,
  type WelcomeAuthScope,
} from "@/lib/legal/welcome-session-scope";

export const runtime = "nodejs";

type WelcomeApiOk = {
  scope: WelcomeAuthScope;
  user: { id: string };
  principal: NonNullable<
    Awaited<ReturnType<typeof resolveLegalSessionPrincipal>>
  >;
};

async function resolveWelcomeApiSession(
  returnTo: string | null,
): Promise<WelcomeApiOk | { error: NextResponse }> {
  const [venueSb, vendorSb] = await Promise.all([
    createClient("venue"),
    createVendorClient(),
  ]);
  const [venueAuth, vendorAuth] = await Promise.all([
    venueSb.auth.getUser(),
    vendorSb.auth.getUser(),
  ]);
  const venueUser = venueAuth.data.user;
  const vendorUser = vendorAuth.data.user;

  const scope = resolveWelcomeAuthScope({
    hasVenueSession: Boolean(venueUser),
    hasVendorSession: Boolean(vendorUser),
    returnTo,
  });

  if (!scope) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const user = scope === "vendor" ? vendorUser! : venueUser!;
  const principal = await resolveLegalSessionPrincipal(user.id, {
    prefer: scope,
  });
  if (!principal) {
    return {
      error: NextResponse.json(
        { error: "Unable to resolve account type." },
        { status: 500 },
      ),
    };
  }
  if (scope === "vendor" && principal.kind !== "vendor") {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { scope, user, principal };
}

/**
 * GET /api/legal/welcome?context=&returnTo=
 * Outstanding docs + copy for the signed-in session principal (venue or vendor jar).
 */
export async function GET(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Legal documents are unavailable." },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const contextParam = url.searchParams.get("context");
  const returnToRaw = url.searchParams.get("returnTo");
  const pathnameHint = url.searchParams.get("pathname");

  try {
    const resolved = await resolveWelcomeApiSession(returnToRaw);
    if ("error" in resolved) return resolved.error;
    const { scope, principal } = resolved;

    const status = await legalAcceptanceService.requiresAcceptance(
      principal.user,
    );
    const hasPrior = outstandingImpliesPriorAcceptance(status.outstanding);
    const returnTo = safeWelcomeReturnToPath(returnToRaw, scope, {
      origin: url.origin,
    });
    const inferred = inferWelcomeContext({
      userType: principal.user.userType,
      pathname: pathnameHint || returnTo,
      hasPriorAcceptance: hasPrior,
    });
    const context: WelcomeFlowContext = welcomeContextForScope(
      scope,
      contextParam,
      inferred,
    );

    const copy = copyForWelcomeContext(context);
    const documents = welcomeDocumentsFromOutstanding(status.outstanding);

    return NextResponse.json({
      ok: true,
      requiresAcceptance: welcomeRequiresReview(status.outstanding),
      context,
      heading: copy.heading,
      introduction: copy.introduction,
      documents,
      returnTo,
      userType: principal.user.userType,
      acceptanceMethod: acceptanceMethodForContext(context),
      scope,
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
 * Body: { legalAccepted: true, context?: WelcomeFlowContext, returnTo?: string }
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

  const returnToRaw =
    typeof body.returnTo === "string" ? body.returnTo : null;

  try {
    const resolved = await resolveWelcomeApiSession(returnToRaw);
    if ("error" in resolved) return resolved.error;
    const { scope, principal } = resolved;

    const status = await legalAcceptanceService.requiresAcceptance(
      principal.user,
    );

    if (!welcomeRequiresReview(status.outstanding)) {
      return NextResponse.json({
        ok: true,
        alreadyAccepted: true,
        recorded: 0,
        alreadyAcceptedCount: 0,
        returnTo: safeWelcomeReturnToPath(returnToRaw, scope),
        scope,
      });
    }

    const hasPrior = outstandingImpliesPriorAcceptance(status.outstanding);
    const contextParam =
      typeof body.context === "string" ? body.context : null;
    const inferred = inferWelcomeContext({
      userType: principal.user.userType,
      hasPriorAcceptance: hasPrior,
    });
    const context: WelcomeFlowContext = welcomeContextForScope(
      scope,
      contextParam,
      inferred,
    );

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

    const returnTo = safeWelcomeReturnToPath(returnToRaw, scope);

    return NextResponse.json({
      ok: true,
      recorded: result.recorded,
      alreadyAcceptedCount: result.alreadyAccepted,
      returnTo,
      context,
      scope,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to record acceptances.";
    console.error("[legal/welcome] POST failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
