/**
 * Setup is where Luv is allowed to be proactive about readiness.
 * One partner note over authoritative gaps — not a second checklist,
 * not a percentage, and not a new destination.
 */
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReadinessImportance, VenueReadinessAssessment } from "@/lib/luv/venue-readiness";

const QUIET: Record<ReadinessImportance, string> = {
  blocker: "text-foreground",
  recommended: "text-foreground",
  optional: "text-muted-foreground",
};

export function OperationalReadinessCard({ assessment }: { assessment: VenueReadinessAssessment | null }) {
  if (!assessment) return null;
  const blockers = assessment.findings.filter((f) => f.importance === "blocker");
  const recommended = assessment.findings.filter((f) => f.importance === "recommended");
  const optional = assessment.findings.filter((f) => f.importance === "optional");
  const shown = blockers.length > 0
    ? [...blockers, ...recommended]
    : recommended.length > 0
      ? recommended
      : optional;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Luv on your setup</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {assessment.opening ? (
          <p className="text-sm text-foreground">{assessment.opening}</p>
        ) : null}
        {assessment.next ? (
          <p className="text-sm text-foreground">{assessment.next}</p>
        ) : null}
        {shown.length > 0 ? (
          <ul className="space-y-3">
            {shown.map((item) => (
              <li key={item.key} className="rounded-lg border border-border p-3">
                <p className={`text-sm font-medium ${QUIET[item.importance]}`}>{item.what}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.why}</p>
                <Link href={item.href} className="mt-2 inline-block text-sm font-medium text-primary hover:underline">
                  {item.actionLabel}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing else needs your attention here.</p>
        )}
      </CardContent>
    </Card>
  );
}
