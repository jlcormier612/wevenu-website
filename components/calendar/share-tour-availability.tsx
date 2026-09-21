"use client";

import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function ShareTourAvailability({ url }: { url: string | null }) {
  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Tour link copied.");
    } catch {
      toast.error("Could not copy the link. Select it and copy it manually.");
    }
  }

  return (
    <div className="h-full rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Tour availability
      </p>
      {url ? (
        <>
          <p className="mt-1 text-sm text-foreground">
            Let couples choose an available time to schedule a tour.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button type="button" size="lg" onClick={copy}>
              Copy tour link
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              aria-label="Preview tour scheduling"
              render={<a href={url} target="_blank" rel="noopener noreferrer" />}
            >
              Preview
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Share this link in emails, texts, and other sales messages. Couples can choose from your available tour times. Your link always reflects your current availability.
          </p>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-foreground">
            Online tour booking is not offered.
          </p>
          <p className="mt-3 text-sm">
            <Link
              href="/settings/availability#tour-availability"
              className="font-medium text-foreground underline underline-offset-4"
            >
              Turn on online tour booking
            </Link>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Couples can schedule a tour from your public link once online tour booking is offered.
          </p>
        </>
      )}
    </div>
  );
}
