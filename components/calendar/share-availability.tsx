"use client";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function ShareAvailability({ url }: { url: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Availability link copied.");
    } catch {
      toast.error("Could not copy the link. Select it and copy it manually.");
    }
  }

  return (
    <div className="h-full rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Public availability
      </p>
      <p className="mt-1 text-sm text-foreground">
        Share your current available dates with couples.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" size="lg" onClick={copy}>
          Copy availability link
        </Button>
        <Button type="button" size="lg" variant="outline" aria-label="Preview public availability" render={<a href={url} target="_blank" rel="noopener noreferrer" />}>
          Preview
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Your link always reflects your current availability.
      </p>
    </div>
  );
}
