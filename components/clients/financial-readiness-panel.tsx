"use client";

import * as React from "react";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { FinancialReadinessModel } from "@/lib/clients/financial-readiness";

export function FinancialReadinessPanel({ financial }: { financial: FinancialReadinessModel }) {
  const [skipped, setSkipped] = React.useState<{ contract: boolean; payment_plan: boolean }>({
    contract: false,
    payment_plan: false,
  });

  return (
    <div
      id="financial-readiness"
      className="rounded-sm border px-6 py-5 text-left"
      style={{ borderColor: "#D8A7AA40", background: "#FDF8F8" }}
    >
      <p className="mb-1 text-xs font-medium uppercase tracking-widest" style={{ color: "#9ca3af" }}>
        {financial.heading}
      </p>
      <p className="mb-4 text-sm" style={{ color: "#3D2F30" }}>
        {financial.summary}
      </p>
      <p className="mb-4 text-xs text-muted-foreground leading-relaxed">{financial.optionalNote}</p>
      <ul className="space-y-3">
        {financial.rows.map((row) => {
          const isSkipped =
            (row.key === "contract" && skipped.contract && !row.onFile) ||
            (row.key === "payment_plan" && skipped.payment_plan && !row.onFile);
          return (
            <li key={row.key} className="flex items-start gap-3 text-sm">
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                style={
                  row.onFile || isSkipped
                    ? { background: "#D8A7AA20", color: "#5A3235" }
                    : { background: "transparent", color: "#9ca3af" }
                }
              >
                {row.onFile || isSkipped ? "✓" : "○"}
              </span>
              <div className="min-w-0 flex-1">
                <p style={{ color: row.onFile || isSkipped ? "#3D2F30" : "#9ca3af" }}>{row.label}</p>
                <p className="text-xs text-muted-foreground">
                  {isSkipped ? "Skipped for this booking — optional." : row.detail}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Link
                  href={row.href}
                  className="text-xs font-medium underline-offset-2 hover:underline"
                  style={{ color: "#5A3235" }}
                >
                  {row.actionLabel}
                </Link>
                {!row.onFile && (row.key === "contract" || row.key === "payment_plan") && !isSkipped && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1 text-[11px] text-muted-foreground"
                    onClick={() => setSkipped((s) => ({ ...s, [row.key]: true }))}
                  >
                    Skip for now
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
