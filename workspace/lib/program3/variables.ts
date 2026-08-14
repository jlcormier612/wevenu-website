import type { Relationship } from "@/lib/types";
import { greetingFirstName } from "@shared/relationships/normalize";

export type TemplateVars = Record<string, string>;

/** Build merge variables for a relationship. */
export function varsForRelationship(relationship: Relationship): TemplateVars {
  return {
    venue_name: relationship.venue.name,
    owner_first_name: greetingFirstName({
      firstName: relationship.owner.firstName,
      lastName: relationship.owner.lastName,
      email: relationship.owner.email,
    }),
    owner_last_name: relationship.owner.lastName || "",
    owner_email: relationship.owner.email || "",
    plan: relationship.planName && relationship.planName !== "—" ? relationship.planName : "your plan",
    city: relationship.venue.city || "",
    state: relationship.venue.state || "",
  };
}

/** Replace {{variable}} tokens. Unknown tokens are left as-is. */
export function interpolate(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      return vars[key] ?? "";
    }
    return match;
  });
}
