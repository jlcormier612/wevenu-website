"use client";

import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/**
 * Public Event Availability — Calendar share card.
 * URL is venue.embedKey → /availability/{embedKey}. No key inventing/rotation here.
 */
export function ShareAvailability({ url }: { url: string | null }) {
  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Event availability link copied.");
    } catch {
      toast.error("Could not copy the link. Select it and copy it manually.");
    }
  }

  return (
    <div
      className="htc-calendar-share-card htc-calendar-share-event h-full"
      data-cal-share="event-availability"
      data-ready={url ? "true" : "false"}
    >
      <div data-cal-share-header="">
        <h3 data-cal-share-title="">Public Event Availability</h3>
      </div>
      <div data-cal-share-body="">
        {url ? (
          <>
            <p data-cal-share-lead="">
              Share the dates your venue currently has available for couples planning their event.
            </p>
            <div data-cal-share-actions="">
              <Button type="button" size="lg" onClick={copy} data-testid="calendar-copy-event-availability">
                Copy event availability link
              </Button>
              <Button
                type="button"
                size="lg"
                variant="outline"
                aria-label="Preview public event availability"
                render={<a href={url} target="_blank" rel="noopener noreferrer" />}
              >
                Preview
              </Button>
            </div>
            <p data-cal-share-helper="">
              Opens the couple-facing availability page in a new tab.
            </p>
          </>
        ) : (
          <>
            <p data-cal-share-lead="">
              Public event availability isn&apos;t available for this venue yet.
            </p>
            <p data-cal-share-helper="">
              This link uses your venue&apos;s public key — the same key as your Inquiry Form. There is no separate
              Calendar switch to turn it on.
            </p>
            <p className="mt-3 text-sm">
              <Link
                href="/settings/leads"
                className="font-medium text-foreground underline underline-offset-4"
              >
                Open Inquiry Form settings
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
