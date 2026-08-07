import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { WelcomeExperienceGate } from "@/components/legal/welcome-experience-gate";
import { welcomeDocumentsFromOutstanding } from "@/components/welcome-experience/welcome-experience-helpers";
import { createClient } from "@/integrations/supabase/server";
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

export const metadata: Metadata = {
  title: "Welcome",
};

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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(
      `/login?next=${encodeURIComponent(
        `/welcome?${new URLSearchParams({
          ...(params.returnTo ? { returnTo: params.returnTo } : {}),
          ...(contextParam ? { context: contextParam } : {}),
        }).toString()}`,
      )}`,
    );
  }

  const principal = await resolveLegalSessionPrincipal(user.id);
  if (!principal) {
    redirect("/login");
  }

  const status = await legalAcceptanceService.requiresAcceptance(
    principal.user,
  );
  const fallback =
    principal.kind === "vendor" ? "/vendor/dashboard" : "/dashboard";
  const returnTo = safeReturnToPath(params.returnTo, { fallback });
  const documents = welcomeDocumentsFromOutstanding(status.outstanding);

  // Only mount Welcome when there is at least one reviewable (active) doc —
  // empty Continue screens cannot record acceptances (venue/vendor/signup).
  if (!welcomeRequiresReview(status.outstanding) || documents.length === 0) {
    redirect(returnTo);
  }

  const hasPrior = outstandingImpliesPriorAcceptance(status.outstanding);
  const context: WelcomeFlowContext = isWelcomeFlowContext(contextParam)
    ? contextParam
    : inferWelcomeContext({
        userType: principal.user.userType,
        pathname: returnTo,
        hasPriorAcceptance: hasPrior,
      });

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

  // Prefer engine when we have a user id; fall back to gate status mapping.
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

  const context: WelcomeFlowContext = isWelcomeFlowContext(contextParam)
    ? contextParam
    : inferWelcomeContext({
        userType: "couple",
        hasPriorAcceptance: hasPrior,
      });
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
