/**
 * Coming up row — whole-row navigation to the booking/event workspace.
 *
 * Interaction affordances match hospitality record lists (record-card-link +
 * understated chevron + focus ring). Keeps Coming up's calm informational
 * styling; does not adopt Today's Focus urgency treatments.
 */
import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import type { ClassifiedItem } from "@/lib/dashboard-system/decision-engine";
import { cn } from "@/lib/utils";

export function ComingUpRow({ item }: { item: ClassifiedItem }): ReactNode {
  return (
    <Link
      href={item.href}
      data-testid="coming-up-item-link"
      data-coming-up-id={item.id}
      className={cn(
        "htc-record-card-link group flex items-start justify-between gap-3 py-3 -mx-2 px-2 rounded-lg",
        "transition-colors hover:bg-muted/40 focus-visible:bg-muted/40",
      )}
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="htc-record-link truncate text-sm font-medium text-foreground">{item.label}</p>
        {item.detail ? (
          <p className="text-xs text-muted-foreground truncate">{item.detail}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2 pt-0.5">
        {item.rightLabel ? (
          <span className="text-xs font-medium text-muted-foreground">{item.rightLabel}</span>
        ) : null}
        <ChevronRight
          className="h-4 w-4 text-muted-foreground/70 transition-colors group-hover:text-muted-foreground group-focus-visible:text-muted-foreground"
          aria-hidden
        />
      </div>
    </Link>
  );
}
