/**
 * Resolve Legal Acceptance Engine user identity for session principals (WP4).
 */

import { createAdminClient } from "@/integrations/supabase/admin";
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { LegalAcceptanceUser } from "@/lib/legal/acceptance-engine";
import type { LegalAcceptanceUserType } from "@/lib/legal/required-documents";
import { mapStaffRoleToLegalUserType } from "@/lib/legal/welcome-integration";

export type ResolvedLegalSessionPrincipal = {
  user: LegalAcceptanceUser;
  /** Staff role string when venue staff (for tests / diagnostics). */
  staffRole: string | null;
  kind: "vendor" | "venue_staff" | "venue_owner_signup";
};

/**
 * Resolve Legal Acceptance identity for a session user id.
 *
 * Default (`prefer` omitted): vendor_users wins over venue_staff when both
 * exist (mirrors vendor-path / login redirect).
 *
 * Pass `prefer: "venue"` when the Welcome/gate caller already selected the
 * venue cookie jar so dual-role accounts are not forced onto vendor docs.
 * Pass `prefer: "vendor"` when the vendor jar was selected.
 */
export async function resolveLegalSessionPrincipal(
  userId: string,
  options?: { prefer?: "vendor" | "venue" },
): Promise<ResolvedLegalSessionPrincipal | null> {
  if (!isSupabaseConfigured || !userId.trim()) return null;

  try {
    const admin = createAdminClient();
    const prefer = options?.prefer;

    const [{ data: vendorRows }, { data: staffRow }] = await Promise.all([
      admin
        .from("vendor_users")
        .select("vendor_id")
        .eq("user_id", userId)
        .eq("is_active", true)
        .limit(1),
      admin
        .from("venue_staff")
        .select("role, is_owner")
        .eq("user_id", userId)
        .maybeSingle<{ role: string; is_owner: boolean }>(),
    ]);
    const vendorRow = Array.isArray(vendorRows) ? vendorRows[0] : vendorRows;

    const asVendor = (): ResolvedLegalSessionPrincipal | null => {
      if (!vendorRow?.vendor_id) return null;
      return {
        kind: "vendor",
        staffRole: null,
        user: { userId, userType: "vendor" },
      };
    };

    const asStaff = (): ResolvedLegalSessionPrincipal | null => {
      if (!staffRow) return null;
      const role = staffRow.is_owner ? "owner" : staffRow.role;
      const userType = mapStaffRoleToLegalUserType(role);
      return {
        kind: "venue_staff",
        staffRole: role,
        user: { userId, userType },
      };
    };

    if (prefer === "vendor") {
      return (
        asVendor() ??
        asStaff() ?? {
          kind: "venue_owner_signup",
          staffRole: null,
          user: {
            userId,
            userType: "venue_owner" satisfies LegalAcceptanceUserType,
          },
        }
      );
    }

    if (prefer === "venue") {
      return (
        asStaff() ??
        asVendor() ?? {
          kind: "venue_owner_signup",
          staffRole: null,
          user: {
            userId,
            userType: "venue_owner" satisfies LegalAcceptanceUserType,
          },
        }
      );
    }

    // Default: vendor wins when both exist.
    return (
      asVendor() ??
      asStaff() ?? {
        kind: "venue_owner_signup",
        staffRole: null,
        user: {
          userId,
          userType: "venue_owner" satisfies LegalAcceptanceUserType,
        },
      }
    );
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
