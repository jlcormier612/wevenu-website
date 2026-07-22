import type { TeamAvailability, TeamDepartment, TeamRole } from "./types";
import { ROLE_LABELS } from "./permissions";

export { ROLE_LABELS };

export const DEPARTMENT_LABELS: Record<TeamDepartment, string> = {
  leadership: "Leadership",
  sales: "Sales",
  customer_success: "Customer Success",
  implementation: "Implementation",
  support: "Support",
  finance: "Finance",
  marketing: "Marketing",
};

export const AVAILABILITY_LABELS: Record<TeamAvailability, string> = {
  available: "Available",
  busy: "Busy",
  ooo: "Out of office",
  part_time: "Part-time",
};

export const TEAM_ROLES: TeamRole[] = [
  "owner",
  "administrator",
  "sales",
  "customer_success",
  "implementation",
  "support",
  "finance",
  "marketing",
  "viewer",
];
