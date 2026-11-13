"use client";

import * as React from "react";

import Link from "next/link";
import { Check, ChevronRight, HelpCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { BringYourBusinessChoices } from "@/components/setup-hub/bring-your-business-choices";
import { SetupReadiness } from "@/components/setup-hub/setup-readiness";
import { SetupConciergeCard } from "@/components/setup-hub/setup-concierge-card";
import { StageAcknowledgeButton } from "@/components/setup-hub/stage-acknowledge-button";
import {
  markStageReviewedAction,
  setYourTeamSoloAction,
} from "@/app/(app)/setup-hub/actions";
import { STAGE_COPY } from "@/lib/setup-hub/stage-copy";
import {
  isBringYourBusinessComplete,
  isCalendarAvailabilityComplete,
  isClientExperienceComplete,
  isFinancialsComplete,
  isYourOfferingsComplete,
  isYourPeopleComplete,
  isYourVenueBasicsReady,
  isYourVenueComplete,
  type YourVenueFacts,
} from "@/lib/setup-hub/stage-completion";
import {
  SETUP_CHAPTERS,
  chapterProgressFromStages,
  recommendNextAction,
} from "@/lib/setup-hub/chapters";
import { evaluateCutoverPrerequisites } from "@/lib/setup-hub/bring-your-business";
import type { SetupReadyCounts } from "@/lib/venue/service";
import type { LeadCaptureStageStatus, SetupHubState } from "@/lib/setup-hub/types";
import type { SetupConciergeEntry } from "@/lib/setup-concierge/types";
import type { SpaceOperatingMode } from "@/lib/venue-spaces/uses";
import type { BringBusinessChoice } from "@/lib/onboarding/types";
import type { SetupStageKey } from "@/lib/setup-hub/help-crosswalk";
import type { SetupStageCompletionStatus } from "@/lib/setup-hub/stage-section-runs";

type StageRow = {
  key: SetupStageKey;
  title: string;
  href?: string;
  hrefLabel?: string;
  /** null = no self-declared/objective signal available yet. */
  status: SetupStageCompletionStatus;
  detail: string;
  required: boolean;
  /** Rendered next to the primary link when the venue hasn't already completed the stage another way. */
  action?: React.ReactNode;
  /** When set, replaces the default single primary link + action row. */
  customActions?: React.ReactNode;
};

function chapterStatusLabel(status: "complete" | "in_progress" | "not_started") {
  if (status === "complete") return "Ready";
  if (status === "in_progress") return "In progress";
  return "Not started";
}

export function SetupHubOverview({
  venueName,
  ownerFirstName,
  hubState,
  leadCapture,
  spacesCount,
  hasCapacityRules,
  tourSchedulingEnabled,
  hasMigrationImport,
  readyCounts,
  uploadedMaterialsCount,
  deliberateTeamActionCount,
  stripeConnected,
  quickbooksConnected,
  setupConcierge,
  maxSimultaneousEvents,
  spaceOperatingMode,
  yourVenueFacts,
  intakeBringBusinessChoice = null,
  setupProfileCount = 0,
}: {
  venueName: string;
  ownerFirstName: string | null;
  hubState: SetupHubState | null;
  leadCapture: LeadCaptureStageStatus | null;
  spacesCount: number;
  hasCapacityRules: boolean;
  tourSchedulingEnabled: boolean;
  /** Migration Center import with durable rows — not spreadsheet/HQ ad-hoc batches. */
  hasMigrationImport: boolean;
  readyCounts: SetupReadyCounts;
  /** Raw files brought over during setup (contracts/wording/checklists uploaded as-is), not yet turned into a Contract/Message Template/Playbook — the "you brought this over, now what?" nudge on Client Experience. */
  uploadedMaterialsCount: number;
  /** Active venue_staff rows created via Team/Owners (invited_by set). */
  deliberateTeamActionCount: number;
  stripeConnected: boolean;
  quickbooksConnected: boolean;
  setupConcierge?: SetupConciergeEntry | null;
  maxSimultaneousEvents?: number | null;
  spaceOperatingMode: SpaceOperatingMode | null;
  yourVenueFacts: YourVenueFacts;
  intakeBringBusinessChoice?: BringBusinessChoice | null;
  /** Venue Setup Profiles — 0 means Library starters are not yet wired to event types. */
  setupProfileCount?: number;
}) {
  const yourVenueDone = isYourVenueComplete(yourVenueFacts);
  const yourVenueBasics = isYourVenueBasicsReady(yourVenueFacts);
  const calendarDone = isCalendarAvailabilityComplete({ spaceOperatingMode, spacesCount });
  const bybPath = hubState?.bringYourBusinessPath ?? null;
  const bringYourBusinessDone = isBringYourBusinessComplete({
    hasMigrationImport,
    path: bybPath,
  });
  const calendarReadyHint = evaluateCutoverPrerequisites({
    spacesCount,
    hasCapacityRules,
    maxSimultaneousEvents,
  }).message;
  const offeringsDone = isYourOfferingsComplete({
    authoredPackageCount: readyCounts.packages,
    authoredInventoryCount: readyCounts.inventory,
    reviewedAt: hubState?.yourOfferingsReviewedAt,
  });
  const clientExperienceCount =
    readyCounts.contractTemplates + readyCounts.communicationTemplates +
    readyCounts.questionnaireTemplates + readyCounts.playbookTemplates;
  const clientExperienceDone = isClientExperienceComplete({
    authoredTemplateCount: clientExperienceCount,
    reviewedAt: hubState?.clientExperienceReviewedAt,
  });
  const yourTeamSolo = !!hubState?.yourTeamSoloConfirmedAt;
  const yourTeamDone = isYourPeopleComplete({
    deliberateTeamActionCount,
    soloConfirmed: yourTeamSolo,
  });
  const financialsDone = isFinancialsComplete({
    stripeConnected,
    reviewedAt: hubState?.financialsReviewedAt,
  });

  const toursLabel = tourSchedulingEnabled ? "offered" : "Not offered";

  const yourVenueStatus: SetupStageCompletionStatus = yourVenueDone
    ? "complete"
    : yourVenueBasics
      ? "in_progress"
      : "not_started";

  const stagesByKey: Record<SetupStageKey, StageRow> = {
    "your-venue": {
      key: "your-venue",
      title: "Your Venue",
      href: STAGE_COPY["your-venue"].destinationHref,
      hrefLabel: STAGE_COPY["your-venue"].destinationLabel,
      status: yourVenueStatus,
      detail: yourVenueDone
        ? "Venue name, contact details, business hours, logo, hero image, and brand colors are in place."
        : yourVenueBasics
          ? "Basics are in place — add hours and branding when you're ready to invite clients."
          : "Open Business & Brand to add your venue name and contact details.",
      required: STAGE_COPY["your-venue"].required,
    },
    "calendar-availability": {
      key: "calendar-availability",
      title: "Spaces & Availability",
      href: STAGE_COPY["calendar-availability"].destinationHref,
      hrefLabel: STAGE_COPY["calendar-availability"].destinationLabel,
      status: calendarDone ? "complete" : spacesCount > 0 ? "in_progress" : "not_started",
      detail: `${spacesCount} space${spacesCount === 1 ? "" : "s"} · Scheduling capacity ${hasCapacityRules ? "set" : "using defaults"} · Tours ${toursLabel}.`,
      required: STAGE_COPY["calendar-availability"].required,
    },
    "lead-capture": {
      key: "lead-capture",
      title: "Get Your Leads Coming In",
      href: STAGE_COPY["lead-capture"].destinationHref,
      hrefLabel: STAGE_COPY["lead-capture"].destinationLabel,
      status: leadCapture?.complete ? "complete" : "not_started",
      detail: leadCapture?.path === "automated"
        ? `${leadCapture.channels.filter((c) => c.configuredAt).length} way${leadCapture.channels.filter((c) => c.configuredAt).length === 1 ? "" : "s"} set up for inquiries to reach you.`
        : leadCapture?.path === "manual_external"
          ? "You're adding leads yourself for now — that's the plan."
          : "Nothing set up yet — or add a practice lead first (no emails or texts sent).",
      required: STAGE_COPY["lead-capture"].required,
    },
    "your-offerings": {
      key: "your-offerings",
      title: "Packages & Pricing",
      href: STAGE_COPY["your-offerings"].destinationHref,
      hrefLabel: STAGE_COPY["your-offerings"].destinationLabel,
      status: offeringsDone ? "complete" : readyCounts.packages > 0 ? "in_progress" : null,
      detail: readyCounts.packages > 0
        ? `${readyCounts.packages} package${readyCounts.packages === 1 ? "" : "s"} ready in Library (including HTC starters you can customize). ${readyCounts.inventory} inventory item${readyCounts.inventory === 1 ? "" : "s"}.`
        : "Open Packages to review starters Hello to Cheers prepared for you.",
      required: STAGE_COPY["your-offerings"].required,
      action: !offeringsDone ? (
        <StageAcknowledgeButton
          action={() => markStageReviewedAction("your-offerings")}
          label="These work for me as-is"
        />
      ) : undefined,
    },
    "client-experience": {
      key: "client-experience",
      title: "Your Client Experience",
      href: STAGE_COPY["client-experience"].destinationHref,
      hrefLabel: STAGE_COPY["client-experience"].destinationLabel,
      status: clientExperienceDone ? "complete" : clientExperienceCount > 0 ? "in_progress" : null,
      detail: `${clientExperienceCount} item${clientExperienceCount === 1 ? "" : "s"} across contracts, questionnaires, messages, and planning guides.`
        + (uploadedMaterialsCount > 0
          ? ` You also brought over ${uploadedMaterialsCount} file${uploadedMaterialsCount === 1 ? "" : "s"} during setup — head to Library to turn the ${uploadedMaterialsCount === 1 ? "one that matters" : "ones that matter"} into templates.`
          : "")
        + (setupProfileCount === 0
          ? " Open Setup Profiles to choose what weddings inherit — wedding starters are never applied automatically to non-wedding bookings."
          : setupProfileCount === 1
            ? " One Setup Profile is in place — confirm it covers the event types you accept."
            : ""),
      required: STAGE_COPY["client-experience"].required,
      action: !clientExperienceDone ? (
        <StageAcknowledgeButton
          action={() => markStageReviewedAction("client-experience")}
          label="These work for me as-is"
        />
      ) : undefined,
    },
    "your-team": {
      key: "your-team",
      title: "Your People",
      href: STAGE_COPY["your-team"].destinationHref,
      hrefLabel: STAGE_COPY["your-team"].destinationLabel,
      status: yourTeamDone ? "complete" : null,
      detail: deliberateTeamActionCount > 0
        ? "You've invited or recorded the people who need their own access."
        : yourTeamSolo
          ? "Running things solo for now — that's the plan."
          : "Decide whether anyone else needs access — or say you're running solo.",
      required: STAGE_COPY["your-team"].required,
      action: !yourTeamDone ? (
        <StageAcknowledgeButton action={setYourTeamSoloAction} label="It's just me for now" />
      ) : undefined,
    },
    financials: {
      key: "financials",
      title: "Online Payments",
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
    "bring-your-business": {
      key: "bring-your-business",
      title: "Bring Your Business",
      status: bringYourBusinessDone ? "complete" : "not_started",
      detail: hasMigrationImport
        ? "Your existing data has been brought in through Migration Center."
        : bybPath === "individual"
          ? "You're adding things yourself — that's the plan."
          : bybPath === "skipped"
            ? "Starting fresh for now — that's the plan."
            : "Already running elsewhere? Import when you're ready — or skip and explore first.",
      required: STAGE_COPY["bring-your-business"].required,
      customActions: (
        <BringYourBusinessChoices
          done={bringYourBusinessDone}
          hasImportedData={hasMigrationImport}
          path={bybPath}
          calendarReadyHint={calendarReadyHint}
          intakeBringBusinessChoice={intakeBringBusinessChoice}
        />
      ),
    },
  };

  const stages: StageRow[] = SETUP_CHAPTERS.flatMap((ch) =>
    ch.stageKeys.map((key) => stagesByKey[key]),
  );

  const chapterProgress = chapterProgressFromStages(stages);
  const recommended = recommendNextAction({ stages });

  return (
    <div className="space-y-6">
      <div className="htc-surface-guidance space-y-2 px-4 py-3" data-testid="setup-hub-orientation">
        <p className="text-sm text-foreground">
          {ownerFirstName ? `${ownerFirstName}, welcome` : "Welcome"} to {venueName}. Four chapters
          help you get oriented — open any chapter in any order. You do not need to finish everything
          before using Hello to Cheers.
        </p>
        <p className="text-sm text-muted-foreground">
          Progress reflects what you&apos;ve actually configured or confirmed — not pages you merely visited.
          Leave and come back anytime; we&apos;ll pick up where you left off.
        </p>
        {setupProfileCount === 0 && readyCounts.playbookTemplates > 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="setup-hub-no-profile-guidance">
            Your Library already has planning starters. Open{" "}
            <Link href="/settings/leads/setup-profiles" className="underline underline-offset-2 hover:text-foreground">
              Setup Profiles
            </Link>{" "}
            when you&apos;re ready to tell Hello to Cheers how weddings should start.
          </p>
        ) : null}
      </div>

      {recommended ? (
        <div
          className="htc-surface-guidance flex flex-col gap-3 rounded-md border border-[color:var(--htc-eucalyptus)]/40 bg-[var(--htc-eucalyptus-surface)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          data-testid="setup-hub-recommended-next"
        >
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Recommended next
            </p>
            <p className="text-sm text-heading">
              {recommended.stageTitle}
              <span className="text-muted-foreground"> · {recommended.chapterTitle}</span>
            </p>
          </div>
          <Link
            href={recommended.href}
            className="htc-setup-quiet-action inline-flex shrink-0 items-center justify-center gap-1 rounded-md border border-[color:var(--htc-eucalyptus)] bg-[var(--htc-eucalyptus-surface)] px-3 py-2 text-xs font-medium text-heading"
          >
            {recommended.hrefLabel}
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      ) : null}

      <SetupConciergeCard entry={setupConcierge ?? null} />

      <div className="space-y-8" data-testid="setup-hub-chapters" data-htc-chapters="four">
        {SETUP_CHAPTERS.map((ch) => {
          const progress = chapterProgress.find((p) => p.id === ch.id)!;
          const chapterStages = ch.stageKeys.map((key) => stagesByKey[key]);
          return (
            <section
              key={ch.id}
              id={`setup-chapter-${ch.id}`}
              className="space-y-3"
              data-testid={`setup-chapter-${ch.id}`}
              data-chapter-status={progress.status}
            >
              <div className="htc-setup-stage-section-label flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0 space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Chapter {ch.number}
                  </p>
                  <h2 className="text-base font-medium text-heading">{ch.title}</h2>
                  <p className="text-sm text-muted-foreground">{ch.guidance}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Badge variant="outline" className={progress.status === "complete" ? "htc-badge-active" : undefined}>
                    {chapterStatusLabel(progress.status)}
                  </Badge>
                  {progress.requiredTotal > 0 ? (
                    <span className="text-xs text-muted-foreground">
                      {progress.requiredDone}/{progress.requiredTotal} essentials
                    </span>
                  ) : null}
                </div>
              </div>

              {ch.id === "sales-process" ? (
                <div
                  className="rounded-md border border-dashed border-border bg-card/60 px-3 py-3"
                  data-testid="setup-hub-practice-lead"
                >
                  <p className="text-sm font-medium text-heading">Safe practice</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Add a practice lead to explore inquiry → tour → package → proposal without emailing,
                    texting, or charging anyone. Label it clearly so it is never confused with a real client.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link
                      href="/leads/new?intent=practice"
                      className="htc-setup-quiet-action inline-flex items-center gap-1 rounded-md border border-[color:var(--htc-eucalyptus)] bg-[var(--htc-eucalyptus-surface)] px-2.5 py-1.5 text-xs font-medium text-heading"
                    >
                      Add a practice lead
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                    <Link
                      href="/library/packages"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
                    >
                      Review starter packages
                    </Link>
                    <Link
                      href="/library/contracts"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
                    >
                      Preview contract starters
                    </Link>
                  </div>
                </div>
              ) : null}

              {ch.id === "client-experience" ? (
                <div
                  className="rounded-md border border-dashed border-border bg-card/60 px-3 py-3"
                  data-testid="setup-hub-client-preview-boundaries"
                >
                  <p className="text-sm font-medium text-heading">Preview vs release</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Prepared resources stay private until you release or invite. Portal preview never sends
                    an invitation. Floor Plans follow existing space and approval rules.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link
                      href="/settings/leads/setup-profiles"
                      className="htc-setup-quiet-action inline-flex items-center gap-1 rounded-md border border-[color:var(--htc-eucalyptus)] bg-[var(--htc-eucalyptus-surface)] px-2.5 py-1.5 text-xs font-medium text-heading"
                    >
                      Open Setup Profiles
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                    <Link
                      href="/library"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
                    >
                      Browse Library starters
                    </Link>
                  </div>
                </div>
              ) : null}

              {ch.id === "make-it-yours" ? (
                <div
                  className="rounded-md border border-dashed border-border bg-card/60 px-3 py-3"
                  data-testid="setup-hub-make-it-yours-extras"
                >
                  <p className="text-sm font-medium text-heading">More when you&apos;re ready</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Branding, communications, and automations are discoverable here — none of them block
                    exploring Hello to Cheers. Automations stay paused until you activate them.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link
                      href="/settings/business"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
                    >
                      Branding
                    </Link>
                    <Link
                      href="/settings/communications"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
                    >
                      Communications
                    </Link>
                    <Link
                      href="/communication/series"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
                    >
                      Automations
                    </Link>
                    <Link
                      href="/settings/integrations"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
                    >
                      Integrations
                    </Link>
                  </div>
                </div>
              ) : null}

              <div className="htc-setup-stage-list space-y-3">
                {chapterStages.map((s) => {
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
                              {s.status === "complete" && (
                                <Badge variant="outline" className="htc-badge-active">Set up</Badge>
                              )}
                              {s.status === "in_progress" && (
                                <Badge variant="outline">In progress</Badge>
                              )}
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
                                    className="htc-setup-quiet-action inline-flex items-center gap-1 rounded-md border border-[color:var(--htc-eucalyptus)] bg-[var(--htc-eucalyptus-surface)] px-2.5 py-1.5 text-xs font-medium text-heading"
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
            </section>
          );
        })}
      </div>

      <SetupReadiness
        stages={stages.map(({ title, status, detail, required }) => ({ title, status, detail, required }))}
        readyToInviteCouples={hubState?.readyToInviteCouples ?? false}
        readyToInviteCouplesAt={hubState?.readyToInviteCouplesAt ?? null}
      />
    </div>
  );
}
