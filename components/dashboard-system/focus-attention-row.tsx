"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";

import { dismissDashboardAttentionAction } from "@/app/(app)/dashboard/actions";
import type { ClassifiedItem, Priority } from "@/lib/dashboard-system/decision-engine";

const PRIORITY_SEVERITY: Record<Priority, "critical" | "warning" | undefined> = {
  critical: "critical",
  needs_attention_today: "warning",
  upcoming: undefined,
  informational: undefined,
};

export function FocusAttentionRow({ item }: { item: ClassifiedItem }): ReactNode {
  const router = useRouter();
  const [hidden, setHidden] = useState(false);
  const [pending, start] = useTransition();
  if (hidden) return null;

  const severity = item.rightSeverity ?? PRIORITY_SEVERITY[item.priority];
  const colorClass = severity === "critical" ? "text-destructive" : severity === "warning" ? "text-warning-foreground" : "text-muted-foreground";
  const canDismiss = Boolean(item.dismissalKey);

  function dismiss() {
    if (!item.dismissalKey) return;
    start(async () => {
      const result = await dismissDashboardAttentionAction(item.dismissalKey!);
      if (!result.ok) return;
      setHidden(true);
      router.refresh();
    });
  }

  return (
    <div className="flex items-start gap-2 py-3 -mx-2 px-2 rounded-lg hover:bg-muted/40 transition-colors">
      <Link href={item.href} className="min-w-0 flex-1 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="truncate text-sm font-medium text-foreground">{item.label}</p>
          {item.detail && <p className="text-xs text-muted-foreground truncate">{item.detail}</p>}
        </div>
        {item.rightLabel && (
          <div className="shrink-0 pt-0.5">
            <span className={`text-xs font-medium ${colorClass}`}>{item.rightLabel}</span>
          </div>
        )}
      </Link>
      {canDismiss ? (
        <button
          type="button"
          onClick={dismiss}
          disabled={pending}
          className="shrink-0 pt-0.5 text-[11px] text-muted-foreground hover:text-foreground"
        >
          {pending ? "Hiding…" : "Dismiss"}
        </button>
      ) : null}
    </div>
  );
}
