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
 * Vendor sessions win over venue staff when both exist (mirrors login redirect).
 */
export async function resolveLegalSessionPrincipal(
  userId: string,
): Promise<ResolvedLegalSessionPrincipal | null> {
  if (!isSupabaseConfigured || !userId.trim()) return null;

  try {
    const admin = createAdminClient();

    const { data: vendorRow } = await admin
      .from("vendor_users")
      .select("vendor_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle<{ vendor_id: string }>();

    if (vendorRow?.vendor_id) {
      return {
        kind: "vendor",
        staffRole: null,
        user: { userId, userType: "vendor" },
      };
    }

    const { data: staffRow } = await admin
      .from("venue_staff")
      .select("role, is_owner")
      .eq("user_id", userId)
      .maybeSingle<{ role: string; is_owner: boolean }>();

    if (staffRow) {
      const role = staffRow.is_owner ? "owner" : staffRow.role;
      const userType = mapStaffRoleToLegalUserType(role);
      return {
        kind: "venue_staff",
        staffRole: role,
        user: { userId, userType },
      };
    }

    // Authenticated but no venue_staff yet — Venue Setup / signup.
    return {
      kind: "venue_owner_signup",
      staffRole: null,
      user: { userId, userType: "venue_owner" satisfies LegalAcceptanceUserType },
    };
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
