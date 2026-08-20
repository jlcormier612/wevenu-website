"use client";

import * as React from "react";

import Link from "next/link";
import { Check, ChevronRight, HelpCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { BringYourBusinessChoices } from "@/components/setup-hub/bring-your-business-choices";
import { SetupReadiness } from "@/components/setup-hub/setup-readiness";
import { OperationalReadinessCard } from "@/components/setup-hub/operational-readiness-card";
import { StageAcknowledgeButton } from "@/components/setup-hub/stage-acknowledge-button";
import {
  markStageReviewedAction,
  setYourTeamSoloAction,
} from "@/app/(app)/setup-hub/actions";
import { STAGE_COPY } from "@/lib/setup-hub/stage-copy";
import type { SetupReadyCounts } from "@/lib/venue/service";
import type { LeadCaptureStageStatus, SetupHubState } from "@/lib/setup-hub/types";
import type { OperationalReadiness } from "@/lib/operational-readiness/types";

type StageRow = {
  key: string;
  title: string;
  href?: string;
  hrefLabel?: string;
  /** null = no self-declared/objective signal available yet. */
  status: "complete" | "in_progress" | "not_started" | null;
  detail: string;
  required: boolean;
  /** Rendered next to the primary link when the venue hasn't already completed the stage another way. */
  action?: React.ReactNode;
  /** When set, replaces the default single primary link + action row. */
  customActions?: React.ReactNode;
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
  operationalReadiness,
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
  operationalReadiness?: OperationalReadiness | null;
}) {
  const yourVenueDone = !!hubState?.yourVenueReviewedAt;
  const calendarDone = !!hubState?.calendarAvailabilityReviewedAt;
  const bringYourBusinessManual = !!hubState?.bringYourBusinessManualConfirmedAt;
  const bringYourBusinessDone = hasImportedData || bringYourBusinessManual;
  const offeringsCount = readyCounts.packages + readyCounts.inventory;
  const offeringsDone = offeringsCount > 0 || !!hubState?.yourOfferingsReviewedAt;
  const clientExperienceCount =
    readyCounts.contractTemplates + readyCounts.communicationTemplates +
    readyCounts.questionnaireTemplates + readyCounts.playbookTemplates;
  const clientExperienceDone = clientExperienceCount > 0 || !!hubState?.clientExperienceReviewedAt;
  const yourTeamSolo = !!hubState?.yourTeamSoloConfirmedAt;
  const yourTeamDone = activeTeamCount > 0 || yourTeamSolo;
  const financialsReviewed = !!hubState?.financialsReviewedAt;

  // Bring Your Business sits early (right after Your Venue) so a venue
  // switching systems sees that choice before spending time rebuilding by hand.
  // Order is guidance only — stages stay revisitable in any sequence.
  const stages: StageRow[] = [
    {
      key: "your-venue",
      title: "Your Venue",
      href: "/settings/business",
      hrefLabel: "Go to Settings",
      status: yourVenueDone ? "complete" : null,
      detail: yourVenueDone ? "You've looked this over." : "Take a look whenever you're ready.",
      required: true,
      action: !yourVenueDone ? (
        <StageAcknowledgeButton
          action={() => markStageReviewedAction("your-venue")}
          label="This looks good for now"
        />
      ) : undefined,
    },
    {
      key: "bring-your-business",
      title: "Bring Your Business",
      status: bringYourBusinessDone ? "complete" : "not_started",
      detail: hasImportedData
        ? "Your existing data has been brought in."
        : bringYourBusinessManual
          ? "You're starting fresh and adding things yourself — that's the plan."
          : "Nothing brought in yet.",
      required: true,
      customActions: (
        <BringYourBusinessChoices
          done={bringYourBusinessDone}
          hasImportedData={hasImportedData}
          manualConfirmed={bringYourBusinessManual}
        />
      ),
    },
    {
      key: "calendar-availability",
      title: "Calendar & Availability",
      href: "/settings/availability",
      hrefLabel: "Go to Settings",
      status: calendarDone ? "complete" : null,
      detail: `${spacesCount} space${spacesCount === 1 ? "" : "s"} added · Scheduling capacity ${hasCapacityRules ? "set" : "using the defaults"} · Online tour booking ${tourSchedulingEnabled ? "on" : "off"}.`,
      required: true,
      action: !calendarDone ? (
        <StageAcknowledgeButton
          action={() => markStageReviewedAction("calendar-availability")}
          label="I've thought this through"
        />
      ) : undefined,
    },
    {
      key: "your-offerings",
      title: "Your Offerings",
      href: "/library/packages",
      hrefLabel: "Go to Library",
      status: offeringsDone ? "complete" : null,
      detail: `${readyCounts.packages} package${readyCounts.packages === 1 ? "" : "s"} of your own, ${readyCounts.inventory} item${readyCounts.inventory === 1 ? "" : "s"} of your own.`,
      required: true,
      action: !offeringsDone ? (
        <StageAcknowledgeButton
          action={() => markStageReviewedAction("your-offerings")}
          label="These work for me as-is"
        />
      ) : undefined,
    },
    {
      key: "client-experience",
      title: "Your Client Experience",
      href: "/library",
      hrefLabel: "Go to Library",
      status: clientExperienceDone ? "complete" : null,
      detail: `${clientExperienceCount} item${clientExperienceCount === 1 ? "" : "s"} of your own across contracts, questionnaires, messages, and planning guides.`,
      required: true,
      action: !clientExperienceDone ? (
        <StageAcknowledgeButton
          action={() => markStageReviewedAction("client-experience")}
          label="These work for me as-is"
        />
      ) : undefined,
    },
    {
      key: "lead-capture",
      title: "Get Your Leads Coming In",
      href: "/setup-hub/lead-capture",
      hrefLabel: "Set this up",
      status: leadCapture?.complete ? "complete" : "not_started",
      detail: leadCapture?.path === "automated"
        ? `${leadCapture.channels.filter((c) => c.configuredAt).length} way${leadCapture.channels.filter((c) => c.configuredAt).length === 1 ? "" : "s"} set up for inquiries to reach you.`
        : leadCapture?.path === "manual_external"
          ? "You're adding leads yourself for now — that's the plan."
          : "Nothing set up yet.",
      required: true,
    },
    {
      key: "your-team",
      title: "Your People",
      href: "/settings/team",
      hrefLabel: "Invite someone",
      status: yourTeamDone ? "complete" : "not_started",
      detail: activeTeamCount > 0
        ? `${activeTeamCount} team member${activeTeamCount === 1 ? "" : "s"} with you here.`
        : yourTeamSolo
          ? "Running things solo for now — that's the plan."
          : "Just you here so far.",
      required: true,
      action: !yourTeamDone ? (
        <StageAcknowledgeButton action={setYourTeamSoloAction} label="It's just me for now" />
      ) : undefined,
    },
    {
      key: "financials",
      title: "Financials",
      href: "/setup-hub/financials",
      hrefLabel: "Connect",
      status: null,
      detail: `Stripe ${stripeConnected ? "connected" : "not connected yet"} · QuickBooks ${quickbooksConnected ? "connected" : "not connected yet"}.`,
      required: false,
      action: !financialsReviewed ? (
        <StageAcknowledgeButton
          action={() => markStageReviewedAction("financials")}
          label="I'll connect these later"
        />
      ) : undefined,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {ownerFirstName ? `${ownerFirstName}, here` : "Here"}&apos;s everything involved in getting {venueName} set up. Work through these in any order, come back as often as you like — nothing is final until you say so.
        </p>
        {!bringYourBusinessDone ? (
          <p className="text-sm text-muted-foreground">
            Already have information in another system? Bringing it over first may save you time before you build everything by hand.
          </p>
        ) : null}
      </div>
      <div className="space-y-3">
        {stages.map((s) => {
          const copy = STAGE_COPY[s.key];
          return (
            <Card key={s.key}>
              <CardContent className="space-y-3 py-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border">
                    {s.status === "complete" && <Check className="h-4 w-4 text-primary" />}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-heading">{s.title}</p>
                      {s.status === "complete" && <Badge variant="outline">Set up</Badge>}
                      {!s.required && <Badge variant="outline">Optional</Badge>}
                    </div>
                    {copy && (
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p>{copy.what}</p>
                        <p>{copy.why}</p>
                        <p>{copy.whatToDo}</p>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">{s.detail}</p>
                    {s.customActions ? (
                      s.customActions
                    ) : (
                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        {s.href && s.hrefLabel ? (
                          <Link
                            href={s.href}
                            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                          >
                            {s.hrefLabel}
                            <ChevronRight className="h-3 w-3" />
                          </Link>
                        ) : null}
                        {s.action}
                        {copy?.helpHref && copy.helpTitle && (
                          <Link
                            href={copy.helpHref}
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
                          >
                            <HelpCircle className="h-3 w-3" />
                            {copy.helpTitle}
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <SetupReadiness
        stages={stages.map(({ title, status, detail, required }) => ({ title, status, detail, required }))}
        readyToInviteCouples={hubState?.readyToInviteCouples ?? false}
        readyToInviteCouplesAt={hubState?.readyToInviteCouplesAt ?? null}
      />
      <OperationalReadinessCard readiness={operationalReadiness ?? null} />
    </div>
  );
}
