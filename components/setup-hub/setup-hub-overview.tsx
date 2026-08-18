"use client";

import * as React from "react";

import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { SetupReadyCounts } from "@/lib/venue/service";
import type { LeadCaptureStageStatus, SetupHubState } from "@/lib/setup-hub/types";

type StageRow = {
  title: string;
  description: string;
  href: string;
  /** null = no approved completion rule yet; stage shows live state only, never a false checkmark. */
  status: "complete" | "in_progress" | "not_started" | null;
  detail: string;
};

export function SetupHubOverview({
  venueName,
  ownerFirstName,
  hubState,
  leadCapture,
  spacesCount,
  hasCapacityRules,
  tourSchedulingEnabled,
  hasImportedData,
  readyCounts,
  activeTeamCount,
  stripeConnected,
  quickbooksConnected,
}: {
  venueName: string;
  ownerFirstName: string | null;
  hubState: SetupHubState | null;
  leadCapture: LeadCaptureStageStatus | null;
  spacesCount: number;
  hasCapacityRules: boolean;
  tourSchedulingEnabled: boolean;
  hasImportedData: boolean;
  readyCounts: SetupReadyCounts;
  activeTeamCount: number;
  stripeConnected: boolean;
  quickbooksConnected: boolean;
}) {
  const bringYourBusinessDone = hasImportedData || !!hubState?.bringYourBusinessManualConfirmedAt;
  const yourTeamDone = activeTeamCount > 0 || !!hubState?.yourTeamSoloConfirmedAt;

  const stages: StageRow[] = [
    {
      title: "Your Venue",
      description: "Venue info, business hours, brand, logo, and primary photo.",
      href: "/settings",
      status: null,
      detail: "Editable any time in Settings.",
    },
    {
      title: "Calendar & Availability",
      description: "Event spaces, scheduling capacity, and tour availability.",
      href: "/settings#capacity",
      status: null,
      detail: `${spacesCount} space${spacesCount === 1 ? "" : "s"} · Capacity rules ${hasCapacityRules ? "set" : "not set"} · Tour scheduling ${tourSchedulingEnabled ? "on" : "off"}`,
    },
    {
      title: "Bring Your Business",
      description: "Import your existing clients, leads, vendors, and inventory — or start fresh.",
      href: "/settings/import",
      status: bringYourBusinessDone ? "complete" : "not_started",
      detail: hasImportedData ? "Data imported." : hubState?.bringYourBusinessManualConfirmedAt ? "Starting manually — confirmed." : "Not yet addressed.",
    },
    {
      title: "Your Offerings",
      description: "Packages and inventory you offer.",
      href: "/library/packages",
      status: null,
      detail: `${readyCounts.packages} package${readyCounts.packages === 1 ? "" : "s"} of your own, ${readyCounts.inventory} inventory item${readyCounts.inventory === 1 ? "" : "s"}.`,
    },
    {
      title: "Client Experience",
      description: "Contracts, questionnaires, message templates, and planning templates you'll use with couples.",
      href: "/library",
      status: null,
      detail: "Reuses your existing Library content.",
    },
    {
      title: "Lead Capture",
      description: "How new inquiries reach Hello to Cheers.",
      href: "/setup-hub/lead-capture",
      status: leadCapture?.complete ? "complete" : "not_started",
      detail: leadCapture?.path === "automated"
        ? `${leadCapture.channels.filter((c) => c.configuredAt).length} channel${leadCapture.channels.filter((c) => c.configuredAt).length === 1 ? "" : "s"} configured.`
        : leadCapture?.path === "manual_external"
          ? "Entering leads manually for now."
          : "Not yet addressed.",
    },
    {
      title: "Your Team",
      description: "Invite coordinators and staff — or confirm it's just you for now.",
      href: "/settings/team",
      status: yourTeamDone ? "complete" : "not_started",
      detail: activeTeamCount > 0 ? `${activeTeamCount} team member${activeTeamCount === 1 ? "" : "s"}.` : hubState?.yourTeamSoloConfirmedAt ? "Just you for now — confirmed." : "Not yet addressed.",
    },
    {
      title: "Financials",
      description: "Stripe and QuickBooks — optional, and can wait.",
      href: "/settings#stripe",
      status: null,
      detail: `Stripe ${stripeConnected ? "connected" : "not connected"} · QuickBooks ${quickbooksConnected ? "connected" : "not connected"}.`,
    },
  ];

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {ownerFirstName ? `${ownerFirstName}, here` : "Here"}&apos;s everything involved in getting {venueName} set up. Work through these in any order, come back as often as you like — nothing is final until you say so.
      </p>
      <div className="space-y-2">
        {stages.map((s) => (
          <Link key={s.title} href={s.href} className="block">
            <Card className="transition-colors hover:border-primary/40">
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border">
                  {s.status === "complete" && <Check className="h-4 w-4 text-primary" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-heading">{s.title}</p>
                    {s.status === "complete" && <Badge variant="outline">Set up</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{s.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{s.detail}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
