/**
 * Resolve Legal Acceptance Engine user identity for session principals (WP4).
 */

import { createAdminClient } from "@/integrations/supabase/admin";
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { LegalAcceptanceUser } from "@/lib/legal/acceptance-engine";
import type { LegalAcceptanceUserType } from "@/lib/legal/required-documents";
import {
  mayFallThroughToVendorOnVenuePath,
  selectVenueStaffMembership,
  type VenueStaffMembershipRow,
} from "@/lib/legal/resolve-venue-staff-membership";
import { mapStaffRoleToLegalUserType } from "@/lib/legal/welcome-integration";
import { readActiveVenueCookie } from "@/lib/venue/active-context-cookie";

export type ResolvedLegalSessionPrincipal = {
  user: LegalAcceptanceUser;
  /** Staff role string when venue staff (for tests / diagnostics). */
  staffRole: string | null;
  kind: "vendor" | "venue_staff" | "venue_owner_signup";
};

function principalFromStaffRow(
  userId: string,
  row: VenueStaffMembershipRow,
): ResolvedLegalSessionPrincipal {
  const role = row.is_owner ? "owner" : row.role;
  const userType = mapStaffRoleToLegalUserType(role);
  return {
    kind: "venue_staff",
    staffRole: role,
    user: { userId, userType },
  };
}

function venueOwnerSignup(userId: string): ResolvedLegalSessionPrincipal {
  return {
    kind: "venue_owner_signup",
    staffRole: null,
    user: {
      userId,
      userType: "venue_owner" satisfies LegalAcceptanceUserType,
    },
  };
}

/**
 * Resolve Legal Acceptance identity for a session user id.
 *
 * Default (`prefer` omitted): vendor_users wins over venue_staff when both
 * exist (mirrors vendor-path / login redirect).
 *
 * Pass `prefer: "venue"` when the Welcome/gate caller already selected the
 * venue cookie jar so dual-role accounts are not forced onto vendor docs.
 * Pass `prefer: "vendor"` when the vendor jar was selected.
 *
 * Pass `activeVenueId` (or rely on `htc_active_venue_id` when prefer=venue)
 * so multi-venue staff resolve against the venue being accessed.
 */
export async function resolveLegalSessionPrincipal(
  userId: string,
  options?: {
    prefer?: "vendor" | "venue";
    activeVenueId?: string | null;
  },
): Promise<ResolvedLegalSessionPrincipal | null> {
  if (!isSupabaseConfigured || !userId.trim()) return null;

  try {
    const admin = createAdminClient();
    const prefer = options?.prefer;

    let activeVenueId = options?.activeVenueId?.trim() || null;
    if (prefer === "venue" && !activeVenueId) {
      activeVenueId = await readActiveVenueCookie();
    }

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

    const asVendor = (): ResolvedLegalSessionPrincipal | null => {
      if (!vendorRow?.vendor_id) return null;
      return {
        kind: "vendor",
        staffRole: null,
        user: { userId, userType: "vendor" },
      };
    };

    const asStaff = (): ResolvedLegalSessionPrincipal | null => {
      if (staffResolution.status !== "resolved") return null;
      return principalFromStaffRow(userId, staffResolution.row);
    };

    /**
     * Venue paths: never treat staff lookup failure / ambiguity as “not
     * venue staff” and fall through to vendor. Fail closed to venue_owner.
     */
    const venuePathStaffOrClosed = (): ResolvedLegalSessionPrincipal => {
      if (staffResolution.status === "resolved") {
        return principalFromStaffRow(userId, staffResolution.row);
      }
      if (mayFallThroughToVendorOnVenuePath(staffResolution)) {
        return asVendor() ?? venueOwnerSignup(userId);
      }
      if (staffResolution.status === "error") {
        console.error(
          "[legal] venue_staff lookup error; failing closed to venue_owner",
          staffResolution.message,
        );
      }
      return venueOwnerSignup(userId);
    };

    if (prefer === "vendor") {
      return asVendor() ?? asStaff() ?? venueOwnerSignup(userId);
    }

    if (prefer === "venue") {
      return venuePathStaffOrClosed();
    }

    // Default: vendor wins when both exist.
    return asVendor() ?? asStaff() ?? venueOwnerSignup(userId);
  } catch (error) {
    console.error("[legal] resolveLegalSessionPrincipal failed", error);
    return null;
  }
}

/** Session user id helper for server components / route handlers. */
export async function getSessionUserId(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}
