/**
 * Single next-action Setup Concierge. Deterministic facts — not a chat.
 */
import Link from "next/link";

import { LuvHeart } from "@/components/dashboard/luv-widget";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SetupConciergeEntry } from "@/lib/setup-concierge/types";

export function SetupConciergeCard({ entry }: { entry: SetupConciergeEntry | null }) {
  if (!entry) return null;

  return (
    <Card data-testid="setup-concierge-card">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-1.5">
          <LuvHeart size={14} /> Next in setup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm font-medium text-foreground">{entry.title}</p>
        <p className="text-sm text-muted-foreground">{entry.body}</p>
        {entry.cannotSee ? (
          <p className="text-xs text-muted-foreground">{entry.cannotSee}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={entry.href}
            className="inline-block text-sm font-medium text-primary hover:underline"
            data-testid="setup-concierge-cta"
          >
            {entry.ctaLabel}
          </Link>
          {entry.helpHref && entry.helpTitle ? (
            <Link
              href={entry.helpHref}
              className="inline-block text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              {entry.helpTitle}
            </Link>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
