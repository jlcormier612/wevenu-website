"use client";

/**
 * Review panel for an Active Commitment proposal before commit.
 * Shows the same numbers the venue must trust: total, lines, paid,
 * remaining, due dates, contract, execution origin, and retained document.
 * Edits update the proposal in place — nothing is committed from here.
 */

import * as React from "react";

import { Button } from "@/components/ui/button";
import type { NormalizedActiveCommitment, ActiveCommitmentScheduleLine } from "@/lib/migration/active-commitment";
import { summarizeCommitmentForReview } from "@/lib/migration/active-commitment";

function moneyLabel(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ActiveCommitmentReview({
  proposal,
  confidenceNotes,
  onChange,
  onConfirm,
  onCancel,
  confirming,
}: {
  proposal: NormalizedActiveCommitment;
  confidenceNotes: string[];
  onChange: (next: NormalizedActiveCommitment) => void;
  onConfirm: () => void;
  onCancel: () => void;
  confirming?: boolean;
}) {
  const summary = summarizeCommitmentForReview(proposal);
  const validationHint = summary.remaining < -0.01
    ? "Paid exceeds contracted total — correct before importing."
    : null;

  function patch(partial: Partial<NormalizedActiveCommitment>) {
    onChange({ ...proposal, ...partial });
  }

  function updateSchedule(index: number, patchLine: Partial<ActiveCommitmentScheduleLine>) {
    const scheduleLines = proposal.scheduleLines.map((line, i) => (
      i === index ? { ...line, ...patchLine } : line
    ));
    patch({ scheduleLines });
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-background p-4">
      <div>
        <p className="text-sm font-semibold text-heading">Review active commitment</p>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
          Confirm every number before importing. This creates the same Event Order, Invoice,
          Payment Schedule, and Documents Hello to Cheers already uses — not a parallel migration ledger.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-border px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Contracted total</p>
          <p className="text-sm font-medium text-heading">{moneyLabel(summary.contractedTotal)}</p>
        </div>
        <div className="rounded-md border border-border px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Already paid</p>
          <p className="text-sm font-medium text-heading">{moneyLabel(summary.paid)}</p>
        </div>
        <div className="rounded-md border border-border px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Remaining</p>
          <p className="text-sm font-medium text-heading">{moneyLabel(summary.remaining)}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs">
          <span className="font-medium text-heading">Client email</span>
          <input
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            value={proposal.clientEmail ?? ""}
            onChange={(e) => patch({ clientEmail: e.target.value })}
          />
        </label>
        <label className="space-y-1 text-xs">
          <span className="font-medium text-heading">Event date</span>
          <input
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            value={proposal.eventDate ?? ""}
            onChange={(e) => patch({ eventDate: e.target.value })}
            placeholder="YYYY-MM-DD"
          />
        </label>
        <label className="space-y-1 text-xs">
          <span className="font-medium text-heading">Contracted total</span>
          <input
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            value={proposal.contractedTotal}
            onChange={(e) => patch({ contractedTotal: e.target.value })}
          />
        </label>
        <label className="space-y-1 text-xs">
          <span className="font-medium text-heading">Package / commitment name</span>
          <input
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            value={proposal.packageName ?? ""}
            onChange={(e) => patch({ packageName: e.target.value })}
          />
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Event Order line items</p>
        {summary.lines.map((line, i) => (
          <div key={`${line.description}-${i}`} className="grid gap-2 rounded-md border border-border px-3 py-2 sm:grid-cols-3">
            <input
              className="rounded-md border border-border bg-background px-2 py-1 text-sm sm:col-span-1"
              value={(proposal.lines ?? summary.lines)[i]?.description ?? line.description}
              onChange={(e) => {
                const lines = [...(proposal.lines?.length ? proposal.lines : summary.lines)];
                lines[i] = { ...lines[i], description: e.target.value };
                patch({ lines });
              }}
            />
            <input
              className="rounded-md border border-border bg-background px-2 py-1 text-sm"
              value={(proposal.lines ?? summary.lines)[i]?.quantity ?? line.quantity}
              onChange={(e) => {
                const lines = [...(proposal.lines?.length ? proposal.lines : summary.lines)];
                lines[i] = { ...lines[i], quantity: e.target.value };
                patch({ lines });
              }}
            />
            <input
              className="rounded-md border border-border bg-background px-2 py-1 text-sm"
              value={(proposal.lines ?? summary.lines)[i]?.unitPrice ?? line.unitPrice}
              onChange={(e) => {
                const lines = [...(proposal.lines?.length ? proposal.lines : summary.lines)];
                lines[i] = { ...lines[i], unitPrice: e.target.value };
                patch({ lines });
              }}
            />
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payment schedule</p>
        {proposal.scheduleLines.map((line, i) => (
          <div key={`${line.label}-${i}`} className="grid gap-2 rounded-md border border-border px-3 py-2 sm:grid-cols-5">
            <input
              className="rounded-md border border-border bg-background px-2 py-1 text-sm sm:col-span-2"
              value={line.label}
              onChange={(e) => updateSchedule(i, { label: e.target.value })}
            />
            <input
              className="rounded-md border border-border bg-background px-2 py-1 text-sm"
              value={line.amount}
              onChange={(e) => updateSchedule(i, { amount: e.target.value })}
            />
            <input
              className="rounded-md border border-border bg-background px-2 py-1 text-sm"
              value={line.dueDate ?? ""}
              onChange={(e) => updateSchedule(i, { dueDate: e.target.value })}
              placeholder="Due YYYY-MM-DD"
            />
            <label className="flex items-center gap-2 text-xs text-heading">
              <input
                type="checkbox"
                checked={!!line.alreadyPaid}
                onChange={(e) => updateSchedule(i, { alreadyPaid: e.target.checked })}
              />
              Paid before HTC
            </label>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs">
          <span className="font-medium text-heading">Externally executed agreement title</span>
          <input
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            value={proposal.contractTitle ?? ""}
            onChange={(e) => patch({ contractTitle: e.target.value })}
          />
        </label>
        <label className="space-y-1 text-xs">
          <span className="font-medium text-heading">Signed date (outside HTC)</span>
          <input
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            value={proposal.contractSignedAt ?? ""}
            onChange={(e) => patch({ contractSignedAt: e.target.value })}
            placeholder="YYYY-MM-DD"
          />
        </label>
      </div>

      <div className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
        <p><span className="font-medium text-heading">Execution origin:</span> {summary.executionOrigin === "external" ? "Signed outside Hello to Cheers (no HTC e-signature)" : "Not recording a live contract row"}</p>
        <p className="mt-1">
          <span className="font-medium text-heading">Source document:</span>{" "}
          {summary.documents[0]
            ? `${summary.documents[0].fileName} (will attach as a real Event document)`
            : "None retained — upload a PDF/DOCX to keep the signed file on the Event"}
        </p>
      </div>

      <label className="flex items-start gap-2 rounded-md border border-border px-3 py-2 text-sm text-heading">
        <input
          type="checkbox"
          className="mt-1"
          checked={!!proposal.shareSignedAgreementWithCouple}
          onChange={(e) => patch({ shareSignedAgreementWithCouple: e.target.checked })}
        />
        <span>
          <span className="font-medium">Share the signed agreement with the couple in their portal</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Uses Hello to Cheers&apos; existing visibility flags. Does not create an HTC e-signature.
            Shares the externally executed contract, the attached signed file, and the invoice/payment plan.
          </span>
        </span>
      </label>

      {confidenceNotes.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          {confidenceNotes.map((note) => <li key={note}>{note}</li>)}
        </ul>
      ) : null}
      {validationHint ? <p className="text-xs text-destructive">{validationHint}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={onConfirm} disabled={confirming || !!validationHint}>
          {confirming ? "Importing…" : "Import this commitment into Hello to Cheers"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={confirming}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
