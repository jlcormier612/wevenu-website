"use client";

import * as React from "react";

import { LuvIntroCard } from "@/components/luv/luv-intro-card";
import { markVendorLuvIntroSeenAction } from "@/app/vendor/actions";

/**
 * Same one-time intro pattern as venue DashboardLuvIntro / couple portal —
 * Luv introduces herself once and leads into a real first action.
 */
export function VendorLuvIntro({
  show,
  ctaLabel = "See today's briefing",
  ctaHref = "/vendor/luv",
}: {
  show: boolean;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  const [dismissed, setDismissed] = React.useState(false);
  if (!show || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    void markVendorLuvIntroSeenAction();
  }

  return (
    <LuvIntroCard
      body="I'll help you stay ahead of messages, tasks, and event details from your venues."
      ctaLabel={ctaLabel}
      ctaHref={ctaHref}
      onDismiss={dismiss}
    />
  );
}
