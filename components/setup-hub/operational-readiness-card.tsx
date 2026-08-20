"use client";

/**
 * Operational Readiness (docs/migration-cutover-architecture.md §D) —
 * deliberately separate from, and never a gate on, the Setup Hub
 * graduation flag above it. A computed read model over real product state,
 * not a checklist to click through. Encouraging framing, not punitive: a
 * venue can use the product regardless of what this reports.
 */
import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { OperationalReadiness } from "@/lib/operational-readiness/types";

export function OperationalReadinessCard({ readiness }: { readiness: OperationalReadiness | null }) {
  if (!readiness) return null;
  const applicable = readiness.domains.filter((d) => !d.notApplicable);
  const allReady = readiness.readyCount === readiness.applicableCount;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {allReady ? "You're ready to run your business here" : "Getting ready to run your business here"}
        </CardTitle>
        <CardDescription>
          {allReady
            ? "Everything below is in place for a real inquiry, start to finish."
            : `${readiness.readyCount} of ${readiness.applicableCount} ready. This isn't a requirement to keep using Hello to Cheers — just a look at what's in place for your next real inquiry.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2">
          {applicable.map((d) => (
            <Link
              key={d.key}
              href={d.href}
              className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm hover:bg-muted/20"
            >
              {d.ready
                ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
              <span>
                <span className="font-medium text-heading">{d.label}</span>
                <span className="block text-xs text-muted-foreground">{d.detail}</span>
              </span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
