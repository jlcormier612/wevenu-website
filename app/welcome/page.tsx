import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { WelcomeExperienceGate } from "@/components/legal/welcome-experience-gate";
import { welcomeDocumentsFromOutstanding } from "@/components/welcome-experience/welcome-experience-helpers";
import {
  createClient,
  createVendorClient,
} from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  getCouplePortalLegalGateStatus,
  legalAcceptanceService,
  resolveCouplePortalLegalIdentity,
} from "@/lib/legal/service";
import {
  copyForWelcomeContext,
  inferWelcomeContext,
  isWelcomeFlowContext,
  outstandingImpliesPriorAcceptance,
  safeReturnToPath,
  welcomeRequiresReview,
  type WelcomeFlowContext,
} from "@/lib/legal/welcome-integration";
import { resolveLegalSessionPrincipal } from "@/lib/legal/resolve-session-principal";
import { publicPathForLegalDocumentType } from "@/lib/legal/public-routes";
import {
  resolveWelcomeAuthScope,
  safeWelcomeReturnToPath,
  welcomeContextForScope,
} from "@/lib/legal/welcome-session-scope";

export const metadata: Metadata = {
  title: "Welcome",
};

// Redirects based on isSupabaseConfigured before touching a dynamic API —
// without this, Next.js can statically prerender that redirect at build
// time and cache it indefinitely, serving it to every request regardless
// of actual session state. This previously caused a login redirect loop:
// every authenticated visitor got the build-time-baked "redirect to
// /login" instead of the real Welcome/legal-acceptance experience.
export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    returnTo?: string;
    context?: string;
    token?: string;
  }>;
};

/**
 * Universal Welcome Experience entry (WP4).
 * Used for venue signup, vendor invitation resume, and returning-user updates.
 * Couple portal may also deep-link here with ?token=.
 *
 * Venue and vendor use separate cookie jars. Scope is resolved from live
 * sessions + returnTo — never from context alone.
 */
export default async function WelcomePage({ searchParams }: Props) {
  if (!isSupabaseConfigured) {
    redirect("/login");
  }

  const params = await searchParams;
  const portalToken = params.token?.trim() || null;
  const contextParam = params.context?.trim() || null;

  if (portalToken) {
    return renderCoupleWelcome(portalToken, params.returnTo, contextParam);
  }

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
    returnTo: params.returnTo,
  });

  if (!scope) {
    redirect(
      `/login?next=${encodeURIComponent(
        `/welcome?${new URLSearchParams({
          ...(params.returnTo ? { returnTo: params.returnTo } : {}),
          ...(contextParam ? { context: contextParam } : {}),
        }).toString()}`,
      )}`,
    );
  }

  const user = scope === "vendor" ? vendorUser! : venueUser!;

  const principal = await resolveLegalSessionPrincipal(user.id, {
    prefer: scope,
  });
  if (!principal) {
    redirect(scope === "vendor" ? "/vendor/login" : "/login");
  }

  if (scope === "vendor" && principal.kind !== "vendor") {
    redirect("/vendor/login");
  }

  const status = await legalAcceptanceService.requiresAcceptance(
    principal.user,
  );
  const returnTo = safeWelcomeReturnToPath(params.returnTo, scope);
  const documents = welcomeDocumentsFromOutstanding(status.outstanding);

  // Only mount Welcome when there is at least one reviewable (active) doc —
  // empty Continue screens cannot record acceptances (venue/vendor/signup).
  if (!welcomeRequiresReview(status.outstanding) || documents.length === 0) {
    redirect(returnTo);
  }

  const hasPrior = outstandingImpliesPriorAcceptance(status.outstanding);
  const inferred = inferWelcomeContext({
    userType: principal.user.userType,
    pathname: returnTo,
    hasPriorAcceptance: hasPrior,
  });
  const context: WelcomeFlowContext = welcomeContextForScope(
    scope,
    contextParam,
    inferred,
  );

  const copy = copyForWelcomeContext(context);

  return (
    <WelcomeExperienceGate
      heading={copy.heading}
      introduction={copy.introduction}
      documents={documents}
      context={context}
      returnTo={returnTo}
    />
  );
}

async function renderCoupleWelcome(
  token: string,
  returnToRaw: string | undefined,
  contextParam: string | null,
) {
  const identity = await resolveCouplePortalLegalIdentity(token);
  if (!identity) {
    redirect(`/p/${encodeURIComponent(token)}`);
  }

  const returnTo = safeReturnToPath(returnToRaw, {
    fallback: `/p/${token}`,
  });

  let documents: {
    title: string;
    version: string;
    effectiveDate: string;
    viewHref: string;
    id?: string;
  }[] = [];
  let requires = true;
  let hasPrior = false;

  if (identity.userId) {
    const status = await legalAcceptanceService.requiresAcceptance({
      userId: identity.userId,
      userType: "couple",
      relationshipId: identity.relationshipId,
    });
    requires = welcomeRequiresReview(status.outstanding);
    hasPrior = outstandingImpliesPriorAcceptance(status.outstanding);
    documents = welcomeDocumentsFromOutstanding(status.outstanding);
  } else {
    const gate = await getCouplePortalLegalGateStatus(identity);
    requires = gate.needsAcceptance;
    documents = gate.documents.map((d) => ({
      id: d.id,
      title: d.title,
      version: d.version,
      effectiveDate: "",
      viewHref: d.path || publicPathForLegalDocumentType(d.documentType),
    }));
  }

  if (!requires || documents.length === 0) {
    redirect(returnTo);
  }

  const inferred = inferWelcomeContext({
    userType: "couple",
    hasPriorAcceptance: hasPrior,
  });
  const context: WelcomeFlowContext =
    isWelcomeFlowContext(contextParam) &&
    (contextParam === "coupleInvitation" || contextParam === "versionUpdate")
      ? contextParam
      : inferred;
  const copy = copyForWelcomeContext(context);

  return (
    <WelcomeExperienceGate
      heading={copy.heading}
      introduction={copy.introduction}
      documents={documents}
      context={context}
      returnTo={returnTo}
      portalToken={token}
    />
  );
}
