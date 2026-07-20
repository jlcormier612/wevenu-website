"use client";

import * as React from "react";

import { LuvIntroCard } from "@/components/luv/luv-intro-card";
import { markLuvIntroSeenAction } from "@/app/(app)/dashboard/actions";

export function DashboardLuvIntro({ show }: { show: boolean }) {
  const [dismissed, setDismissed] = React.useState(false);
  if (!show || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    void markLuvIntroSeenAction();
  }

  return (
    <LuvIntroCard
      body="I'll help you stay ahead of everything happening at your venue."
      ctaLabel="Let's finish setting up your venue"
      ctaHref="#getting-started"
      onDismiss={dismiss}
    />
  );
}
