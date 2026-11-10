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
  mayFallThroughToVendorOnVenuePath,
  selectVenueStaffMembership,
  type VenueStaffMembershipRow,
} from "@/lib/legal/resolve-venue-staff-membership";
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

/** Exported for focused regression tests. */
export async function resolveUserTypeForProxy(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  prefer: "vendor" | "venue" = "vendor",
  activeVenueId?: string | null,
): Promise<{
  userType: Exclude<
    import("@/lib/legal/required-documents").LegalAcceptanceUserType,
    "couple"
  >;
  kind: "vendor" | "venue_staff" | "venue_owner_signup";
}> {
  const [{ data: vendorRows }, staffQuery] = await Promise.all([
    admin
      .from("vendor_users")
      .select("vendor_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1),
    admin
      .from("venue_staff")
      .select("venue_id, role, is_owner, is_active")
      .eq("user_id", userId)
      .eq("is_active", true),
  ]);
  const vendorRow = Array.isArray(vendorRows) ? vendorRows[0] : vendorRows;
  const staffResolution = selectVenueStaffMembership({
    rows: (staffQuery.data ?? null) as VenueStaffMembershipRow[] | null,
    error: staffQuery.error,
    activeVenueId,
  });

  const asVendor = () =>
    vendorRow?.vendor_id
      ? ({ userType: "vendor" as const, kind: "vendor" as const })
      : null;

  const asStaff = () => {
    if (staffResolution.status !== "resolved") return null;
    const row = staffResolution.row;
    const role = row.is_owner ? "owner" : row.role;
    return {
      userType: mapStaffRoleToLegalUserType(role),
      kind: "venue_staff" as const,
    };
  };

  if (prefer === "venue") {
    if (staffResolution.status === "resolved") {
      return asStaff()!;
    }
    if (mayFallThroughToVendorOnVenuePath(staffResolution)) {
      return (
        asVendor() ?? {
          userType: "venue_owner",
          kind: "venue_owner_signup",
        }
      );
    }
    if (staffResolution.status === "error") {
      console.error(
        "[legal] proxy venue_staff lookup error; failing closed to venue_owner",
        staffResolution.message,
      );
    }
    return {
      userType: "venue_owner",
      kind: "venue_owner_signup",
    };
  }

  return (
    asVendor() ??
    asStaff() ?? {
      userType: "venue_owner",
      kind: "venue_owner_signup",
    }
  );
}

/**
 * Ask the engine whether this authenticated user may proceed.
 * `@supabaseClient` is unused today but kept for future cookie-scoped checks.
 *
 * Pass `prefer: "venue"` on venue app paths so dual-role accounts are not
 * forced through vendor legal while using the venue session. Vendor app paths
 * keep the default vendor preference.
 *
 * Pass `activeVenueId` from `htc_active_venue_id` on venue paths so multi-venue
 * staff resolve against the venue being accessed.
 */
export async function decideLegalProxyEnforcement(input: {
  user: User;
  pathname: string;
  search: string;
  supabase?: SupabaseClient;
  prefer?: "vendor" | "venue";
  activeVenueId?: string | null;
}): Promise<ProxyLegalDecision> {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
      return { action: "allow" };
    }

    const admin = createAdminClient();
    const prefer = input.prefer ?? "vendor";
    const resolved = await resolveUserTypeForProxy(
      admin,
      input.user.id,
      prefer,
      prefer === "venue" ? input.activeVenueId : null,
    );
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
