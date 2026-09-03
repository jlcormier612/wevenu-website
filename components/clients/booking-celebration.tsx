"use client";

import * as React from "react";

import Link from "next/link";

import { CommunicationsReviewPanel } from "@/components/clients/communications-review-panel";
import { EventExperienceReviewPanel } from "@/components/clients/event-experience-review-panel";
import { FinancialReadinessPanel } from "@/components/clients/financial-readiness-panel";
import { PreparePlanningPanel } from "@/components/clients/prepare-planning-panel";
import { Button } from "@/components/ui/button";
import type { BookingHandoffModel } from "@/lib/clients/booking-handoff";
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

function PrepareChecklist({ handoff }: { handoff: BookingHandoffModel }) {
  return (
    <div
      className="rounded-sm border px-6 py-5 text-left"
      style={{ borderColor: "#D8A7AA40", background: "#FDF8F8" }}
    >
      <p className="mb-4 text-xs font-medium uppercase tracking-widest" style={{ color: "#9ca3af" }}>
        {handoff.prepareHeading}
      </p>
      <ul className="space-y-2.5">
        {handoff.items.map((item) => (
          <li key={item.key} className="flex items-start gap-3 text-sm">
            <span
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
              style={
                item.complete
                  ? { background: "#D8A7AA20", color: "#5A3235" }
                  : { background: "transparent", color: "#9ca3af" }
              }
            >
              {item.complete ? "✓" : "○"}
            </span>
            <div className="min-w-0 flex-1">
              <p style={{ color: item.complete ? "#3D2F30" : "#9ca3af" }}>
                {item.label}
              </p>
              <p className="text-xs text-muted-foreground">{item.detail}</p>
            </div>
            <Link
              href={item.href}
              className="shrink-0 text-xs font-medium underline-offset-2 hover:underline"
              style={{ color: "#5A3235" }}
            >
              {item.actionLabel}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BookingCelebration({
  client,
  eventId,
  eventDate,
  eventType,
  templates,
  applications,
  handoff,
  financial,
  communications,
  experience,
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
      <Confetti />

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

        <PrepareChecklist handoff={handoff} />

        <PreparePlanningPanel
          eventId={eventId ?? null}
          eventDate={eventDate ?? null}
          eventType={eventType ?? client.eventType}
          templates={templates}
          applications={applications}
        />

        <FinancialReadinessPanel financial={financial} />

        <EventExperienceReviewPanel experience={experience} />

        <CommunicationsReviewPanel communications={communications} />

        <div className="space-y-3 border-t border-border pt-6">
          <p className="text-sm italic text-muted-foreground">
            {handoff.tagline}
          </p>
        </div>

        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button render={<Link href={handoff.primaryHref} />}>
            {handoff.primaryLabel}
          </Button>
          {eventId && (
            <Button variant="outline" render={<Link href={`/events/${eventId}`} />}>
              Open Event
            </Button>
          )}
          <Button
            variant="ghost"
            render={<Link href={`/clients/${client.id}`} />}
            className="text-muted-foreground"
          >
            View Client
          </Button>
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
