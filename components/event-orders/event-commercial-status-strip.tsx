"use client";

/**
 * C3 — Commercial status strip: chips + deep links only.
 * Does not Share, Finalize, Send, create invoices, or create payment plans.
 */

import * as React from "react";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
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
          follow after the agreed Event Order. Use the chips to open the existing workflow — actions
          stay on those screens.
        </p>
      </div>
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
