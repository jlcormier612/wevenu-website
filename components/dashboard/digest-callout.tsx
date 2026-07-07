"use client";

import * as React from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { dismissDigestIntroAction } from "@/app/(app)/dashboard/actions";

export function DigestCallout() {
  const [dismissed, setDismissed] = React.useState(false);

  async function handleDismiss() {
    setDismissed(true);
    await dismissDigestIntroAction();
  }

  if (dismissed) return null;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-info/30 bg-info/8 px-4 py-3 text-sm">
      <span className="mt-0.5 text-info shrink-0" aria-hidden>ℹ</span>
      <p className="flex-1 text-muted-foreground leading-relaxed">
        You&apos;ll get a morning email each day with your priorities.{" "}
        Don&apos;t want it?{" "}
        <Link href="/settings#notifications" className="font-medium text-foreground underline underline-offset-2">
          Turn it off in Notification Preferences →
        </Link>
      </p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => void handleDismiss()}
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors mt-0.5"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
