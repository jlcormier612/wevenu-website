"use client";

import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/**
 * Tour Scheduling — Calendar share card (general public link only).
 * Personalized lead links stay on the lead Tour & follow-up workflow (origin token).
 */
export function ShareTourAvailability({ url }: { url: string | null }) {
  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("General tour scheduling link copied.");
    } catch {
      toast.error("Could not copy the link. Select it and copy it manually.");
    }
  }

  return (
    <div
      className="htc-calendar-share-card htc-calendar-share-tour h-full"
      data-cal-share="tour-scheduling"
      data-ready={url ? "true" : "false"}
      data-testid="calendar-share-tour-link"
    >
      <div data-cal-share-header="">
        <h3 data-cal-share-title="">Tour Scheduling</h3>
      </div>
      <div data-cal-share-body="">
        {url ? (
          <>
            <p data-cal-share-lead="">
              Let prospective couples choose an available time to visit your venue.
            </p>
            <div data-cal-share-actions="">
              <Button type="button" size="lg" onClick={copy} data-testid="calendar-copy-tour-link">
                Copy tour scheduling link
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
            <p data-cal-share-helper="">
              Opens the couple-facing tour scheduling page in a new tab.
            </p>
            <div data-cal-share-guidance="" data-testid="calendar-tour-link-lead-guidance">
              <p>
                Already working with someone? Use the personalized scheduling link on their lead record,
                under &apos;Tour &amp; follow-up&apos;. That preserves preferred date holds and other information
                you already gathered. This Calendar link is the general link for websites, QR codes, and new
                prospects only.
              </p>
            </div>
          </>
        ) : (
          <>
            <p data-cal-share-lead="">
              Online tour booking is not offered yet.
            </p>
            <p data-cal-share-helper="">
              Turn it on when you want couples to pick an available visit time themselves.
            </p>
            <p className="mt-3 text-sm">
              <Link
                href="/settings/availability#tour-availability"
                className="font-medium text-foreground underline underline-offset-4"
              >
                Set up tour scheduling
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
