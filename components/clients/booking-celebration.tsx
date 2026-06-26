"use client";

import * as React from "react";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  clientDisplayName,
  eventTypeLabel,
  formatDate,
} from "@/lib/clients/constants";
import type { Client } from "@/lib/clients/types";

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

// ---- Celebration ------------------------------------------------------------

export function BookingCelebration({ client }: { client: Client }) {
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

      {/* Content — above confetti */}
      <div className="relative z-30 mx-auto max-w-lg space-y-8">
        {/* Celebration mark */}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-success/10 text-5xl select-none">
          🎉
        </div>

        {/* Headline */}
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Congratulations
          </p>
          <h1 className="font-heading text-4xl font-medium tracking-tight text-heading sm:text-5xl">
            {displayName}
          </h1>
          <p className="text-xl text-muted-foreground">are officially booked.</p>
        </div>

        {/* Event summary */}
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

        {/* Divider + tagline */}
        <div className="space-y-3 border-t border-border pt-6">
          <p className="text-sm italic text-muted-foreground">
            Thank you for helping another couple begin their story.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button render={<Link href={`/clients/${client.id}`} />}>
            View Client
          </Button>
          <Button
            variant="outline"
            render={<Link href={`/clients/${client.id}/edit`} />}
          >
            Start Planning
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
