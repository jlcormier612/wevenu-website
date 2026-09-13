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
import { evaluateCutoverPrerequisites } from "@/lib/setup-hub/bring-your-business";
import type { SetupReadyCounts } from "@/lib/venue/service";
import type { LeadCaptureStageStatus, SetupHubState } from "@/lib/setup-hub/types";
import type { OperationalReadiness } from "@/lib/operational-readiness/types";

type StageRow = {
  key: keyof typeof STAGE_COPY;
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
  uploadedMaterialsCount,
  activeTeamCount,
  stripeConnected,
  quickbooksConnected,
  operationalReadiness,
  maxSimultaneousEvents,
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
  /** Raw files brought over during setup (contracts/wording/checklists uploaded as-is), not yet turned into a Contract/Message Template/Playbook — the "you brought this over, now what?" nudge on Client Experience. */
  uploadedMaterialsCount: number;
  activeTeamCount: number;
  stripeConnected: boolean;
  quickbooksConnected: boolean;
  operationalReadiness?: OperationalReadiness | null;
  maxSimultaneousEvents?: number | null;
}) {
  const yourVenueDone = !!hubState?.yourVenueReviewedAt;
  const calendarDone = !!hubState?.calendarAvailabilityReviewedAt;
  const bybPath = hubState?.bringYourBusinessPath ?? null;
  const bringYourBusinessDone = hasImportedData || bybPath === "individual" || bybPath === "skipped";
  const calendarReadyHint = evaluateCutoverPrerequisites({
    spacesCount,
    hasCapacityRules,
    maxSimultaneousEvents,
  }).message;
  const offeringsCount = readyCounts.packages + readyCounts.inventory;
  const offeringsDone = offeringsCount > 0 || !!hubState?.yourOfferingsReviewedAt;
  const clientExperienceCount =
    readyCounts.contractTemplates + readyCounts.communicationTemplates +
    readyCounts.questionnaireTemplates + readyCounts.playbookTemplates;
  const clientExperienceDone = clientExperienceCount > 0 || !!hubState?.clientExperienceReviewedAt;
  const yourTeamSolo = !!hubState?.yourTeamSoloConfirmedAt;
  const yourTeamDone = activeTeamCount > 0 || yourTeamSolo;
  const financialsReviewed = !!hubState?.financialsReviewedAt;
  const financialsDone = stripeConnected || financialsReviewed;

  const toursLabel = tourSchedulingEnabled ? "offered" : "Not offered";

  const stages: StageRow[] = [
    {
      key: "your-venue",
      title: "Your Venue",
      href: STAGE_COPY["your-venue"].destinationHref,
      hrefLabel: STAGE_COPY["your-venue"].destinationLabel,
      status: yourVenueDone ? "complete" : null,
      detail: yourVenueDone ? "You've looked this over." : "Take a look whenever you're ready.",
      required: STAGE_COPY["your-venue"].required,
      action: !yourVenueDone ? (
        <StageAcknowledgeButton
          action={() => markStageReviewedAction("your-venue")}
          label="This looks good for now"
        />
      ) : undefined,
    },
    {
      key: "calendar-availability",
      title: "Calendar & Availability",
      href: STAGE_COPY["calendar-availability"].destinationHref,
      hrefLabel: STAGE_COPY["calendar-availability"].destinationLabel,
      status: calendarDone ? "complete" : null,
      detail: `${spacesCount} space${spacesCount === 1 ? "" : "s"} · Scheduling capacity ${hasCapacityRules ? "set" : "using defaults"} · Tours ${toursLabel}.`,
      required: STAGE_COPY["calendar-availability"].required,
      action: !calendarDone ? (
        <StageAcknowledgeButton
          action={() => markStageReviewedAction("calendar-availability")}
          label="I've thought this through"
        />
      ) : undefined,
    },
    {
      key: "bring-your-business",
      title: "Bring Your Business",
      status: bringYourBusinessDone ? "complete" : "not_started",
      detail: hasImportedData
        ? "Your existing data has been brought in."
        : bybPath === "individual"
          ? "You're adding things yourself — that's the plan."
          : bybPath === "skipped"
            ? "Starting fresh for now — that's the plan."
            : "Nothing brought in yet.",
      required: STAGE_COPY["bring-your-business"].required,
      customActions: (
        <BringYourBusinessChoices
          done={bringYourBusinessDone}
          hasImportedData={hasImportedData}
          path={bybPath}
          calendarReadyHint={calendarReadyHint}
        />
      ),
    },
    {
      key: "your-offerings",
      title: "Your Offerings",
      href: STAGE_COPY["your-offerings"].destinationHref,
      hrefLabel: STAGE_COPY["your-offerings"].destinationLabel,
      status: offeringsDone ? "complete" : null,
      detail: `${readyCounts.packages} package${readyCounts.packages === 1 ? "" : "s"} of your own, ${readyCounts.inventory} item${readyCounts.inventory === 1 ? "" : "s"} of your own.`,
      required: STAGE_COPY["your-offerings"].required,
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
      href: STAGE_COPY["client-experience"].destinationHref,
      hrefLabel: STAGE_COPY["client-experience"].destinationLabel,
      status: clientExperienceDone ? "complete" : null,
      detail: `${clientExperienceCount} item${clientExperienceCount === 1 ? "" : "s"} of your own across contracts, questionnaires, messages, and planning guides.`
        + (uploadedMaterialsCount > 0
          ? ` You also brought over ${uploadedMaterialsCount} file${uploadedMaterialsCount === 1 ? "" : "s"} during setup — head to Library to turn the ones that matter into templates.`
          : ""),
      required: STAGE_COPY["client-experience"].required,
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
      href: STAGE_COPY["lead-capture"].destinationHref,
      hrefLabel: STAGE_COPY["lead-capture"].destinationLabel,
      status: leadCapture?.complete ? "complete" : "not_started",
      detail: leadCapture?.path === "automated"
        ? `${leadCapture.channels.filter((c) => c.configuredAt).length} way${leadCapture.channels.filter((c) => c.configuredAt).length === 1 ? "" : "s"} set up for inquiries to reach you.`
        : leadCapture?.path === "manual_external"
          ? "You're adding leads yourself for now — that's the plan."
          : "Nothing set up yet.",
      required: STAGE_COPY["lead-capture"].required,
    },
    {
      key: "your-team",
      title: "Your People",
      href: STAGE_COPY["your-team"].destinationHref,
      hrefLabel: STAGE_COPY["your-team"].destinationLabel,
      status: yourTeamDone ? "complete" : null,
      detail: activeTeamCount > 0
        ? `${activeTeamCount} team member${activeTeamCount === 1 ? "" : "s"} with you here.`
        : yourTeamSolo
          ? "Running things solo for now — that's the plan."
          : "Just you here so far. Solo is fine whenever you're ready to say so.",
      required: STAGE_COPY["your-team"].required,
      action: !yourTeamDone ? (
        <StageAcknowledgeButton action={setYourTeamSoloAction} label="It's just me for now" />
      ) : undefined,
    },
    {
      key: "financials",
      title: "Online payments",
      href: STAGE_COPY.financials.destinationHref,
      hrefLabel: STAGE_COPY.financials.destinationLabel,
      status: financialsDone ? "complete" : null,
      detail: `Stripe ${stripeConnected ? "connected" : "not connected yet"} · QuickBooks ${quickbooksConnected ? "connected" : "not connected yet"}.`,
      required: STAGE_COPY.financials.required,
      action: !financialsDone ? (
        <StageAcknowledgeButton
          action={() => markStageReviewedAction("financials")}
          label="I'll do this later"
        />
      ) : undefined,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {ownerFirstName ? `${ownerFirstName}, here` : "Here"}&apos;s what helps {venueName} feel ready for real clients. Work in any order that makes sense — leave and come back anytime.
        </p>
        {!bringYourBusinessDone ? (
          <p className="text-sm text-muted-foreground">
            Already have clients elsewhere? Importing is one path — adding things yourself or starting fresh are equally fine.
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
