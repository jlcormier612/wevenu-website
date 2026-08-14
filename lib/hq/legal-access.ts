/**
 * HQ Business → Legal access. Owners only (HQ role `owner`).
 * Architecture maps elevated HQ access to `owner`; `team` must not reach Legal.
 * `super_admin` is accepted if ever added to hq_admins.role without breaking checks.
 */

import type { HqAdmin, HqAdminRole } from "@/lib/hq/types";

const LEGAL_ADMIN_ROLES = new Set<string>(["owner", "super_admin"]);

/** True when the HQ role may access `/admin/legal*`. */
export function canAccessHqLegalAdmin(
  admin: HqAdmin | null | undefined,
): boolean {
  if (!admin?.role) return false;
  return LEGAL_ADMIN_ROLES.has(admin.role);
}

/** Pure role check for tests and call sites that already resolved the role string. */
export function isHqLegalAdminRole(
  role: HqAdminRole | string | null | undefined,
): boolean {
  if (!role) return false;
  return LEGAL_ADMIN_ROLES.has(role);
}
