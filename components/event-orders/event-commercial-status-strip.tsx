"use client";

/**
 * C3/C4 — Commercial status strip: chips + checklist + deep links only.
 * Does not Share, Finalize, Send, create invoices, or create payment plans.
 */

import * as React from "react";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  buildCommercialNextAction,
  buildCommercialProgressSteps,
  buildCommercialStatusChips,
  type CommercialNavTarget,
  type CommercialStatusInput,
} from "@/lib/event-orders/commercial-status";

export function EventCommercialStatusStrip({
  input,
  onNavigate,
}: {
  input: CommercialStatusInput;
  onNavigate: (target: CommercialNavTarget) => void;
}) {
  const chips = React.useMemo(() => buildCommercialStatusChips(input), [input]);
  const steps = React.useMemo(() => buildCommercialProgressSteps(input), [input]);
  const nextAction = React.useMemo(() => buildCommercialNextAction(input), [input]);

  return (
    <div
      className="mb-4 rounded-lg border border-border bg-muted/30 px-3 py-3 space-y-3"
      data-testid="event-commercial-status-strip"
    >
      <div>
        <p className="text-sm font-medium text-heading">Commercial workspace</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Event-level home for commercial progress. Inventory selection and client-selectable choices
          are separate workflows. Applying a template is not sharing an Event Order; client submission
          is not venue confirmation; finalizing is distinct from sharing; invoice and payment plan
          follow after the agreed Event Order. Use the chips and checklist to open the existing
          workflow — actions stay on those screens.
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground" data-testid="commercial-path-wiring">
          Fixed Event Order (no choice groups): Library Use / Apply → Finalize → Share on Event Order.
          Library Send is only for templates with choice groups. Inventory selection runs on the
          Inventory tab; Your Choices runs in Client selections below.
        </p>
      </div>

      <ol
        className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Commercial progress"
        data-testid="event-commercial-progress-checklist"
      >
        {steps.map((step, index) => (
          <li key={step.id}>
            <button
              type="button"
              className={
                step.state === "complete"
                  ? "flex h-full w-full flex-col rounded-md border border-border bg-background px-2.5 py-2 text-left text-xs"
                  : step.state === "current"
                    ? "flex h-full w-full flex-col rounded-md border border-primary/40 bg-background px-2.5 py-2 text-left text-xs ring-1 ring-primary/20"
                    : "flex h-full w-full flex-col rounded-md border border-dashed border-border/80 bg-transparent px-2.5 py-2 text-left text-xs opacity-80"
              }
              data-testid={`commercial-progress-${step.id}`}
              data-state={step.state}
              onClick={() => onNavigate(step.nav)}
            >
              <span className="font-medium text-heading">
                {index + 1}. {step.label}
              </span>
              <span className="mt-0.5 capitalize text-muted-foreground">{step.state}</span>
              <span className="mt-1 text-[11px] leading-snug text-muted-foreground">{step.detail}</span>
            </button>
          </li>
        ))}
      </ol>

      {nextAction ? (
        <div data-testid="event-commercial-next-action">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-auto min-h-8 whitespace-normal px-2.5 py-1.5 text-left text-xs"
            data-testid="commercial-next-action"
            onClick={() => onNavigate(nextAction.nav)}
          >
            Next: {nextAction.label}
          </Button>
        </div>
      ) : null}

      <nav
        className="flex flex-wrap gap-2"
        aria-label="Commercial status"
        data-testid="event-commercial-status-chips"
      >
        {chips.map((chip) => {
          const body = (
            <>
              <span className="font-medium text-heading">{chip.label}</span>
              <span className="text-muted-foreground"> · {chip.status}</span>
            </>
          );
          if (chip.nav.kind === "href") {
            return (
              <Button
                key={chip.id}
                type="button"
                size="sm"
                variant="outline"
                className="h-auto min-h-8 whitespace-normal px-2.5 py-1.5 text-left text-xs"
                data-testid={`commercial-chip-${chip.id}`}
                render={<Link href={chip.nav.href} />}
              >
                {body}
              </Button>
            );
          }
          return (
            <Button
              key={chip.id}
              type="button"
              size="sm"
              variant="outline"
              className="h-auto min-h-8 whitespace-normal px-2.5 py-1.5 text-left text-xs"
              data-testid={`commercial-chip-${chip.id}`}
              onClick={() => onNavigate(chip.nav)}
            >
              {body}
            </Button>
          );
        })}
      </nav>
      <div
        className="flex flex-wrap gap-2 border-t border-border pt-2"
        data-testid="event-commercial-subnav"
      >
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          data-testid="commercial-anchor-choices"
          onClick={() => onNavigate({ kind: "tab", tab: "event-order", anchor: "event-order-choices" })}
        >
          Choices
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          data-testid="commercial-anchor-order"
          onClick={() => onNavigate({ kind: "tab", tab: "event-order", anchor: "event-order-order" })}
        >
          Event Order
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          data-testid="commercial-anchor-invoice"
          onClick={() => onNavigate({ kind: "tab", tab: "event-order", anchor: "event-order-invoice" })}
        >
          Invoice
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          data-testid="commercial-open-inventory"
          onClick={() => onNavigate({ kind: "tab", tab: "inventory" })}
        >
          Open Inventory
        </Button>
      </div>
    </div>
  );
}
