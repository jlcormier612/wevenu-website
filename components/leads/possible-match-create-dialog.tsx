"use client";

import * as React from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { signalLabel, type DuplicateCandidate } from "@/lib/leads/duplicate-detection";
import { statusLabel } from "@/lib/leads/constants";

/**
 * Non-blocking venue warning before creating a Lead or Client that may
 * already exist. Caller still creates the record if the venue continues.
 */
export function PossibleMatchCreateDialog({
  open,
  matches,
  onContinue,
  onCancel,
  pending,
}: {
  open: boolean;
  matches: DuplicateCandidate[];
  onContinue: () => void;
  onCancel: () => void;
  pending?: boolean;
}) {
  const top = matches[0];
  if (!top) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>We may already have this couple</DialogTitle>
          <DialogDescription>
            Strong matching information suggests this person may already be in your records.
            You can review the existing record, or create a separate one if these are different
            customers.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border border-border px-3 py-2 text-sm">
          <p className="font-medium text-heading">{top.displayName}</p>
          {top.email ? <p className="text-muted-foreground">{top.email}</p> : null}
          {top.phone ? <p className="text-muted-foreground">{top.phone}</p> : null}
          {top.salesStage ? (
            <p className="text-muted-foreground">Status: {statusLabel(top.salesStage)}</p>
          ) : null}
          <p className="mt-1 text-xs text-muted-foreground">
            Matched by: {top.signals.map(signalLabel).join(", ")}
          </p>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
            Go back
          </Button>
          <div className="flex flex-wrap gap-2">
            {top.leadId ? (
              <Button
                type="button"
                variant="secondary"
                render={<Link href={`/leads/${top.leadId}`} />}
              >
                Review existing
              </Button>
            ) : top.clientId ? (
              <Button
                type="button"
                variant="secondary"
                render={<Link href={`/clients/${top.clientId}`} />}
              >
                Review existing
              </Button>
            ) : null}
            <Button type="button" onClick={onContinue} disabled={pending}>
              Create anyway
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
