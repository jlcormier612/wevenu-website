"use client";

import * as React from "react";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { isBookingWorkspaceHref, type BookingHandoffModel } from "@/lib/clients/booking-handoff";
import type { CommunicationsReviewModel } from "@/lib/clients/communications-review";
import type { EventExperienceReviewModel } from "@/lib/clients/event-experience-review";
import type { FinancialReadinessModel } from "@/lib/clients/financial-readiness";
import {
  clientDisplayName,
  eventTypeLabel,
  formatDate,
} from "@/lib/clients/constants";
import type { Client } from "@/lib/clients/types";
import type { EventPlaybookApplication, PlaybookTemplate } from "@/lib/playbooks/types";

// ---- Confetti ---------------------------------------------------------------

const CONFETTI_COLORS = [
  "#5D6F5D", // Heritage Sage
  "#B9D1C2", // Soft Sage
  "#D8A7AA", // Dusty Rose
  "#DED6CA", // Taupe Light
  "#4F5F4F", // Forest Sage
  "#B8AEA1", // Taupe Dark
];

type Particle = {
  id: number;
  x: number;
  delay: number;
  duration: number;
  color: string;
  size: number;
  rotate: number;
  round: boolean;
};

function Confetti() {
  const [particles, setParticles] = React.useState<Particle[]>([]);

  React.useEffect(() => {
    setParticles(
      Array.from({ length: 45 }, (_, i) => ({
        id: i,
        x: 2 + Math.random() * 96,
        delay: Math.random() * 2.2,
        duration: 3.2 + Math.random() * 2.5,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        size: 5 + Math.random() * 7,
        rotate: Math.random() * 360,
        round: Math.random() > 0.45,
      })),
    );
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-20 overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            left: `${p.x}%`,
            top: "-14px",
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            borderRadius: p.round ? "50%" : "3px",
            animation: `confetti-fall ${p.duration}s ease-in ${p.delay}s forwards`,
            opacity: 0,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}

type StepState = "done" | "next" | "later";

function StepMarker({ index, state }: { index: number; state: StepState }) {
  return (
    <span
      aria-hidden
      className={
        state === "done"
          ? "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success/15 text-xs font-semibold text-success"
          : state === "next"
            ? "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
            : "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-xs font-semibold text-muted-foreground"
      }
    >
      {state === "done" ? "✓" : index}
    </span>
  );
}

function BookedNextSteps({
  handoff,
  financial,
  communications,
}: {
  handoff: BookingHandoffModel;
  financial: FinancialReadinessModel;
  communications: CommunicationsReviewModel;
}) {
  const released = handoff.items.find((item) => item.key === "client_planning")?.complete ?? false;
  const invitation = communications.rows.find((row) => row.key === "invitation");
  const invited = invitation?.onFile ?? false;
  const automated = communications.rows.find((row) => row.key === "automated_messages");
  const steps: Array<{ key: string; title: string; detail: string; state: StepState }> = [
    {
      key: "event_setup",
      title: "Set up their event",
      detail: "Choose what the couple will see — planning, timeline, floor plans, and vendors.",
      state: released ? "done" : "next",
    },
    {
      key: "release",
      title: "Release planning to the couple",
      detail: released ? "Released." : "From Event setup, once it's ready.",
      state: released ? "done" : "later",
    },
    {
      key: "invite",
      title: "Invite the couple",
      detail: invited && invitation
        ? invitation.detail
        : "Last, after planning is released — an invitation can't be taken back.",
      state: invited ? "done" : released ? "next" : "later",
    },
  ];

  return (
    <div
      className="rounded-lg border border-border bg-card px-5 py-5 text-left text-card-foreground shadow-sm"
      data-testid="booked-next-steps"
    >
      <p className="mb-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {handoff.prepareHeading}
      </p>
      <ol className="space-y-3.5">
        {steps.map((step, i) => (
          <li key={step.key} className="flex items-start gap-3" data-testid={`booked-step-${step.key}`}>
            <StepMarker index={i + 1} state={step.state} />
            <div className="min-w-0 flex-1">
              <p className={step.state === "later" ? "text-sm font-medium text-muted-foreground" : "text-sm font-medium text-foreground"}>
                {step.title}
              </p>
              <p className="text-xs text-muted-foreground">{step.detail}</p>
              {step.key === "event_setup" && !released ? (
                <Button className="mt-2.5" render={<Link href={handoff.primaryHref} />} data-testid="booked-continue-event-setup">
                  {handoff.primaryLabel}
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-5 space-y-1.5 border-t border-border pt-4 text-xs" data-testid="booked-on-file">
        <p className="font-medium uppercase tracking-widest text-muted-foreground">On file</p>
        <ul className="space-y-1">
          {financial.rows.map((row) => (
            <li key={row.key} className="flex items-center gap-2">
              <span aria-hidden className={row.onFile ? "text-success" : "text-destructive"}>
                {row.onFile ? "✓" : "!"}
              </span>
              <span className="min-w-0 flex-1 text-foreground">
                {row.label}: {row.detail}
              </span>
              {row.onFile || isBookingWorkspaceHref(row.href) ? null : (
                <Link href={row.href} className="shrink-0 font-medium text-foreground underline-offset-2 hover:underline">
                  {row.actionLabel}
                </Link>
              )}
            </li>
          ))}
          {automated ? (
            <li className="flex items-center gap-2">
              <span aria-hidden className="text-muted-foreground">•</span>
              <span className="min-w-0 flex-1 text-foreground">{automated.detail}</span>
              {isBookingWorkspaceHref(automated.href) ? null : (
                <Link href={automated.href} className="shrink-0 font-medium text-foreground underline-offset-2 hover:underline">
                  {automated.actionLabel}
                </Link>
              )}
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}

export function BookingCelebration({
  celebrate = false,
  client,
  eventId: _eventId,
  eventDate: _eventDate,
  eventType: _eventType,
  templates: _templates,
  applications: _applications,
  handoff,
  financial,
  communications,
  experience: _experience,
}: {
  client: Client;
  eventId?: string | null;
  eventDate?: string | null;
  eventType?: string | null;
  templates: PlaybookTemplate[];
  applications: EventPlaybookApplication[];
  handoff: BookingHandoffModel;
  financial: FinancialReadinessModel;
  communications: CommunicationsReviewModel;
  experience: EventExperienceReviewModel;
  celebrate?: boolean;
}) {
  const displayName = clientDisplayName(
    client.firstName,
    client.lastName,
    client.partnerFirstName,
    client.partnerLastName,
  );

  const details = [
    eventTypeLabel(client.eventType),
    formatDate(client.eventDate),
    client.guestCount != null
      ? `${client.guestCount.toLocaleString()} guests`
      : null,
  ].filter(Boolean);

  return (
    <div className="relative flex min-h-[80vh] flex-col items-center justify-center px-4 py-16 text-center">
      {celebrate ? <Confetti /> : null}

      <div className="relative z-30 mx-auto max-w-xl space-y-8">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-success/10 text-5xl select-none">
          🎉
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            {handoff.eyebrow}
          </p>
          <h1 className="font-heading text-4xl font-medium tracking-tight text-heading sm:text-5xl">
            {displayName}
          </h1>
          <p className="text-xl text-muted-foreground">
            {handoff.bookingLine}
          </p>
          {client.leadId ? (
            <p className="text-sm text-muted-foreground">
              <Link
                href={`/leads/${client.leadId}`}
                className="hover:text-foreground hover:underline"
                data-testid="view-original-lead"
              >
                View original lead
              </Link>
            </p>
          ) : null}
        </div>

        {details.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-foreground">
            {details.map((d, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="text-border">·</span>}
                <span>{d}</span>
              </React.Fragment>
            ))}
          </div>
        )}

        <BookedNextSteps handoff={handoff} financial={financial} communications={communications} />

        <p className="text-sm text-muted-foreground">{handoff.tagline}</p>

        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          {handoff.items.find((item) => item.key === "client_planning")?.complete ? (
            <Button render={<Link href={handoff.primaryHref} />}>{handoff.primaryLabel}</Button>
          ) : null}
          <Button
            variant="ghost"
            render={<Link href="/dashboard" />}
            className="text-muted-foreground"
          >
            Return to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
