import type { Permission, TeamRole } from "./types";

export const ALL_PERMISSIONS: Permission[] = [
  "view_business_dashboard",
  "view_today",
  "view_relationships",
  "edit_relationships",
  "view_walkthroughs",
  "manage_walkthroughs",
  "view_onboarding",
  "manage_onboarding",
  "view_tasks",
  "manage_tasks",
  "view_workflows",
  "manage_workflows",
  "view_communications",
  "manage_communications",
  "view_founding",
  "manage_welcome_back",
  "manage_product_sync",
  "view_reports",
  "view_finance",
  "view_commissions",
  "manage_commissions",
  "view_team",
  "manage_team",
  "manage_settings",
];

export const ROLE_LABELS: Record<TeamRole, string> = {
  owner: "Owner",
  administrator: "Administrator",
  sales: "Sales",
  customer_success: "Customer Success",
  implementation: "Implementation",
  support: "Support",
  finance: "Finance",
  marketing: "Marketing",
  viewer: "Viewer",
};

const OPS_VIEW: Permission[] = [
  "view_today",
  "view_relationships",
  "view_walkthroughs",
  "view_onboarding",
  "view_tasks",
  "view_workflows",
  "view_communications",
];

/**
 * Role → permission matrix. Everything in the app is gated from this.
 * Business Dashboard (`view_business_dashboard`) is Owner + Finance primarily;
 * Administrator also has it (full ops access).
 * Founder Dashboard (`view_founding`) is Owner + Administrator only.
 * Welcome Back verify (`manage_welcome_back`) is Owner, Administrator, Customer Success.
 * Product Sync provision (`manage_product_sync`) is Owner + Administrator only.
 */
export const ROLE_PERMISSIONS: Record<TeamRole, readonly Permission[]> = {
  owner: ALL_PERMISSIONS,

  administrator: ALL_PERMISSIONS.filter((p) => p !== "manage_commissions"),

  sales: [
    ...OPS_VIEW,
    "edit_relationships",
    "manage_walkthroughs",
    "view_workflows",
    "manage_workflows",
    "view_commissions",
    "view_reports",
    "view_team",
  ],

  customer_success: [
    ...OPS_VIEW,
    "edit_relationships",
    "manage_onboarding",
    "manage_tasks",
    "manage_communications",
    "manage_welcome_back",
    "view_workflows",
    "view_reports",
    "view_team",
  ],

  implementation: [
    "view_today",
    "view_relationships",
    "view_onboarding",
    "manage_onboarding",
    "view_tasks",
    "manage_tasks",
    "view_communications",
    "view_team",
  ],

  support: [
    "view_today",
    "view_relationships",
    "view_tasks",
    "manage_tasks",
    "view_communications",
    "manage_communications",
    "view_team",
  ],

  finance: [
    "view_business_dashboard",
    "view_today",
    "view_relationships",
    "view_reports",
    "view_finance",
    "view_commissions",
    "manage_commissions",
    "view_team",
  ],

  marketing: [
    "view_today",
    "view_relationships",
    "view_communications",
    "view_reports",
    "view_team",
  ],

  viewer: [
    "view_today",
    "view_relationships",
    "view_walkthroughs",
    "view_onboarding",
    "view_tasks",
    "view_workflows",
    "view_communications",
    "view_reports",
    "view_team",
  ],
};

export function permissionsForRole(role: TeamRole): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}

export function roleHasPermission(role: TeamRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** Nav href → required permission (hide if missing). */
export const NAV_PERMISSION: Record<string, Permission> = {
  "/business": "view_business_dashboard",
  "/today": "view_today",
  "/sales": "view_relationships",
  "/customer-success": "view_relationships",
  "/support": "view_relationships",
  "/relationships": "view_relationships",
  "/walkthroughs": "view_walkthroughs",
  "/onboarding": "view_onboarding",
  "/tasks": "view_tasks",
  "/workflows": "view_workflows",
  "/sequences": "view_communications",
  "/communications": "view_communications",
  "/founding": "view_founding",
  "/reports": "view_reports",
  "/commissions": "view_commissions",
  "/team": "view_team",
  // Settings stays visible; team management gated inside by manage_team.
};

/** Page path prefix → permission for hard gate (redirect). */
export const PAGE_PERMISSION: { prefix: string; permission: Permission }[] = [
  { prefix: "/business", permission: "view_business_dashboard" },
  { prefix: "/today", permission: "view_today" },
  { prefix: "/dashboard", permission: "view_today" },
  { prefix: "/sales", permission: "view_relationships" },
  { prefix: "/customer-success", permission: "view_relationships" },
  { prefix: "/support", permission: "view_relationships" },
  { prefix: "/relationships", permission: "view_relationships" },
  { prefix: "/walkthroughs", permission: "view_walkthroughs" },
  { prefix: "/onboarding", permission: "view_onboarding" },
  { prefix: "/tasks", permission: "view_tasks" },
  { prefix: "/workflows", permission: "view_workflows" },
  { prefix: "/sequences", permission: "view_communications" },
  { prefix: "/communications", permission: "view_communications" },
  { prefix: "/founding", permission: "view_founding" },
  { prefix: "/reports", permission: "view_reports" },
  { prefix: "/commissions", permission: "view_commissions" },
  { prefix: "/team", permission: "view_team" },
];

export function permissionForPath(pathname: string): Permission | null {
  const match = PAGE_PERMISSION.find(
    (row) => pathname === row.prefix || pathname.startsWith(`${row.prefix}/`),
  );
  return match?.permission ?? null;
}
