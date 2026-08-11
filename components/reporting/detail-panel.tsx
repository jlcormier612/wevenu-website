import Link from "next/link";
import { X } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Work Package R2 — the one shared "small detail panel" shape every
 * drill-down uses (brief §32: "Metric → small detail panel/list → click
 * record → actual workspace," never a giant data table). A plain Server
 * Component — the URL itself (via each report's `?detail=` param) is the
 * only state; `closeHref` just drops that param.
 */
export function DetailPanel({
  title,
  closeHref,
  children,
  isEmpty,
  emptyText,
}: {
  title: string;
  closeHref: string;
  children: React.ReactNode;
  isEmpty: boolean;
  emptyText: string;
}) {
  return (
    <Card className="border-primary/25 bg-primary/[0.03]">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">{title}</CardTitle>
          <Link href={closeHref} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Close detail">
            <X className="h-3.5 w-3.5" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {isEmpty ? <p className="py-4 text-center text-sm text-muted-foreground">{emptyText}</p> : children}
      </CardContent>
    </Card>
  );
}

export function DetailRow({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-4 py-1.5 text-sm border-b border-border/60 last:border-0">{children}</div>;
}
