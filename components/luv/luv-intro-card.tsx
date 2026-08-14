"use client";

/**
 * Luv Experience Completion, Work Stream 5 — the one place, per audience,
 * Luv introduces herself. Deliberately not a tour: one card, shown once,
 * that leads directly into the audience's first real action rather than
 * stopping at a generic welcome ("a concierge greeting someone as they
 * walk through the front door," per the approved brief).
 */
import * as React from "react";
import Link from "next/link";
import { X } from "lucide-react";

import { LuvHeart } from "@/components/dashboard/luv-widget";

export function LuvIntroCard({
  body,
  ctaLabel,
  ctaHref,
  onCtaClick,
  onDismiss,
}: {
  body: string;
  ctaLabel: string;
  ctaHref?: string;
  /** Alternative to ctaHref for in-SPA navigation (e.g. switching a tab without a real URL). */
  onCtaClick?: () => void;
  onDismiss: () => void;
}) {
  return (
    <div data-luv-intro-card className="relative rounded-2xl border p-4 pr-10" style={{ borderColor: "#D8A7AA55", backgroundColor: "#D8A7AA0F" }}>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 rounded-sm"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5"><LuvHeart size={18} /></span>
        <div className="space-y-2">
          <p className="text-sm text-foreground">
            <span className="font-semibold">Welcome! I&apos;m Luv.</span> {body}
          </p>
          {ctaHref ? (
            <Link
              href={ctaHref}
              onClick={onDismiss}
              className="inline-block text-sm font-medium underline underline-offset-2"
              style={{ color: "#5D6F5D" }}
            >
              {ctaLabel} →
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => { onDismiss(); onCtaClick?.(); }}
              className="text-sm font-medium underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 rounded-sm"
              style={{ color: "#5D6F5D" }}
            >
              {ctaLabel} →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
