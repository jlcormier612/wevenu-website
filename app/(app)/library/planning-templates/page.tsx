import { permanentRedirect } from "next/navigation";

/**
 * Canonical Planning Templates collection is /library/playbooks.
 * Keep this alias so mistyped /library/planning-templates does not 404.
 */
export default function PlanningTemplatesAliasPage() {
  permanentRedirect("/library/playbooks");
}
