/**
 * Legal compliance enforcement helper for the Next.js proxy (WP4).
 * Uses the Legal Acceptance Engine; fails open when admin/env is unavailable
 * so local/dev without service role is not bricked.
 */

import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/integrations/supabase/admin";
import { legalAcceptanceService } from "@/lib/legal/acceptance-engine";
import {
  inferWelcomeContext,
  mapStaffRoleToLegalUserType,
  outstandingImpliesPriorAcceptance,
  welcomeRequiresReview,
  type WelcomeFlowContext,
} from "@/lib/legal/welcome-integration";
import { evaluateLegalMiddleware } from "@/lib/legal/welcome-middleware";

export type ProxyLegalDecision =
  | { action: "allow" }
  | {
      action: "redirect_welcome";
      welcomePath: string;
    }
  | {
      action: "block_api";
      welcomePath: string;
      code: "legal_acceptance_required";
    };

async function resolveUserTypeForProxy(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<{
  userType: Exclude<
    import("@/lib/legal/required-documents").LegalAcceptanceUserType,
    "couple"
  >;
  kind: "vendor" | "venue_staff" | "venue_owner_signup";
}> {
  const { data: vendorRow } = await admin
    .from("vendor_users")
    .select("vendor_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle<{ vendor_id: string }>();

  if (vendorRow?.vendor_id) {
    return { userType: "vendor", kind: "vendor" };
  }

  const { data: staffRow } = await admin
    .from("venue_staff")
    .select("role, is_owner")
    .eq("user_id", userId)
    .maybeSingle<{ role: string; is_owner: boolean }>();

  if (staffRow) {
    const role = staffRow.is_owner ? "owner" : staffRow.role;
    return {
      userType: mapStaffRoleToLegalUserType(role),
      kind: "venue_staff",
    };
  }

  return { userType: "venue_owner", kind: "venue_owner_signup" };
}

/**
 * Ask the engine whether this authenticated user may proceed.
 * `@supabaseClient` is unused today but kept for future cookie-scoped checks.
 */
export async function decideLegalProxyEnforcement(input: {
  user: User;
  pathname: string;
  search: string;
  supabase?: SupabaseClient;
}): Promise<ProxyLegalDecision> {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
      return { action: "allow" };
    }

    const admin = createAdminClient();
    const resolved = await resolveUserTypeForProxy(admin, input.user.id);
    const status = await legalAcceptanceService.requiresAcceptance({
      userId: input.user.id,
      userType: resolved.userType,
    });

    const hasPrior = outstandingImpliesPriorAcceptance(status.outstanding);
    const context: WelcomeFlowContext = inferWelcomeContext({
      userType: resolved.userType,
      pathname: input.pathname,
      hasPriorAcceptance: hasPrior,
    });

    // Gate only on reviewable (active) outstanding docs — same rule as
    // /welcome + /api/legal/welcome, so missing active rows cannot loop users.
    const decision = evaluateLegalMiddleware({
      pathname: input.pathname,
      search: input.search,
      requiresAcceptance: welcomeRequiresReview(status.outstanding),
      context,
      enabled: true,
    });

    if (decision.action === "allow") return { action: "allow" };
    if (decision.action === "redirect_welcome") {
      return {
        action: "redirect_welcome",
        welcomePath: decision.welcomePath,
      };
    }
    return {
      action: "block_api",
      welcomePath: decision.welcomePath,
      code: "legal_acceptance_required",
    };
  } catch (error) {
    // Fail open — never take down the app if legal infra is mid-migrate.
    // Must NOT clear Supabase cookies or call signOut; callers only redirect/allow.
    console.error("[legal] proxy enforcement failed open", error);
    return { action: "allow" };
  }
}
