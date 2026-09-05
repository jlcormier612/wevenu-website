"use client";

/**
 * In-page Automations help — progressive disclosure, not a setup wizard.
 * Venue-facing language only.
 */

import * as React from "react";

import { ChevronDown, ChevronRight, HelpCircle } from "lucide-react";

import { cn } from "@/lib/utils";

function HelpSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="border-t border-border first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 py-2.5 text-left text-sm font-medium text-heading"
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span>{title}</span>
      </button>
      {open && <div className="space-y-2 pb-3 pl-6 text-sm text-muted-foreground leading-relaxed">{children}</div>}
    </div>
  );
}

export function AutomationsHelp({ className }: { className?: string }) {
  const [open, setOpen] = React.useState(false);

  return (
    <section
      className={cn("rounded-lg border border-border bg-muted/30", className)}
      aria-label="How automations work"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-heading">How automations work</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Automations help you stay in touch with leads and clients without having to remember every follow-up.
            {!open && " Open for a short guide."}
          </p>
        </div>
        {open ? (
          <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="space-y-0 border-t border-border px-4 pb-1 pt-1">
          <HelpSection title="What an automation is" defaultOpen>
            <p>
              An automation is a simple follow-up plan: when something happens (or when you add someone),
              Hello to Cheers sends messages for you on a schedule you choose.
            </p>
          </HelpSection>

          <HelpSection title="How it starts">
            <p>An automation can start when:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>A new inquiry comes in</li>
              <li>A lead reaches a sales stage you choose</li>
              <li>A tour is marked completed</li>
              <li>Or only when you add someone yourself</li>
            </ul>
          </HelpSection>

          <HelpSection title="What happens over time">
            <p>
              Each person moves through the messages on their own timeline. Timing is relative —
              for example, “send immediately, then again 2 days later.” Editing an automation
              affects people who join after you save; people already in it keep the plan they started with.
            </p>
          </HelpSection>

          <HelpSection title="What causes it to stop">
            <p>For an individual person, messages stop when they:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Book</li>
              <li>Are marked Lost</li>
              <li>Reply to a message</li>
              <li>Finish every step</li>
              <li>Or you stop them</li>
            </ul>
          </HelpSection>

          <HelpSection title="One person at a time">
            <p>
              People progress independently. You can pause or stop one person without pausing the
              whole automation for everyone else.
            </p>
          </HelpSection>

          <HelpSection title="Pause vs stop">
            <p>
              <span className="font-medium text-heading">Pause the automation</span> — new people
              won&apos;t join, and people already in it won&apos;t receive scheduled messages until you resume.
            </p>
            <p>
              <span className="font-medium text-heading">Pause one person</span> — only that person
              waits; everyone else continues.
            </p>
            <p>
              <span className="font-medium text-heading">Stop one person</span> — they won&apos;t get
              any more messages from this automation. Their conversation and past messages stay.
            </p>
          </HelpSection>

          <HelpSection title="Useful examples">
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <span className="font-medium text-heading">New inquiry follow-up</span> — welcome
                right away, then a gentle check-in a few days later
              </li>
              <li>
                <span className="font-medium text-heading">Tour follow-up</span> — thank them after a
                completed tour and answer common next questions
              </li>
              <li>
                <span className="font-medium text-heading">Sales follow-up</span> — continue the
                conversation after a proposal goes out
              </li>
              <li>
                <span className="font-medium text-heading">Booking-related</span> — a warm handoff
                when someone books (if you choose that starting point)
              </li>
            </ul>
          </HelpSection>
        </div>
      )}
    </section>
  );
}
