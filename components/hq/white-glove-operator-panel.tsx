"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  finishWhiteGloveSetupAction,
  startOperatorConfigureAction,
} from "@/app/admin/onboarding/actions";

export type OperatorStageStatus =
  | "we_can_finish"
  | "decision_needed"
  | "can_complete_later"
  | "in_progress"
  | "complete";

export type OperatorStageRow = {
  key: string;
  title: string;
  status: OperatorStageStatus;
  detail?: string | null;
};

const STATUS_LABEL: Record<OperatorStageStatus, string> = {
  we_can_finish: "We can finish this",
  decision_needed: "Your decision needed",
  can_complete_later: "Can be completed later",
  in_progress: "In progress",
  complete: "Complete",
};

export function WhiteGloveOperatorPanel({
  venueId,
  venueName,
  whiteGloveStatus,
  stages,
  materials,
  intakeSummary,
  validationIssues,
}: {
  venueId: string;
  venueName: string;
  whiteGloveStatus: string | null;
  stages: OperatorStageRow[];
  materials: Array<{ id: string; fileName: string; url: string | null }>;
  intakeSummary: string | null;
  validationIssues: Array<{ code: string; message: string }>;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handedOff =
    whiteGloveStatus === "setup_complete_access_pending" ||
    whiteGloveStatus === "complete";

  async function finish() {
    setBusy(true);
    setError(null);
    const result = await finishWhiteGloveSetupAction(venueId);
    setBusy(false);
    if (!result.ok) {
      const msg =
        result.issues?.map((i) => i.message).join(" ") ||
        result.error ||
        "Handoff failed";
      setError(msg);
      return;
    }
    setConfirmOpen(false);
    router.refresh();
  }

  return (
    <div className="space-y-6 rounded-xl border border-border bg-card p-6">
      <div>
        <h2 className="font-heading text-sm font-semibold text-heading">
          White Glove — {venueName}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Status: {whiteGloveStatus ?? "unknown"} · Work on the real venue Setup Hub and
          migration tools below. Do not graduate the venue for the customer.
        </p>
      </div>

      {intakeSummary ? (
        <div className="rounded-md border bg-muted/20 p-3 text-sm whitespace-pre-wrap">
          {intakeSummary}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Intake not submitted yet.</p>
      )}

      {materials.length > 0 ? (
        <div>
          <p className="text-xs font-medium mb-2">Materials received</p>
          <ul className="space-y-1 text-sm">
            {materials.map((m) => (
              <li key={m.id}>
                {m.url ? (
                  <a href={m.url} className="text-primary underline" target="_blank" rel="noreferrer">
                    {m.fileName}
                  </a>
                ) : (
                  m.fileName
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No materials uploaded.</p>
      )}

      <div className="space-y-2">
        <p className="text-xs font-medium">Setup Hub status</p>
        {stages.map((s) => (
          <div
            key={s.key}
            className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border px-3 py-2 text-sm"
          >
            <span className="font-medium">{s.title}</span>
            <span className="text-xs text-muted-foreground">{STATUS_LABEL[s.status]}</span>
            {s.detail ? (
              <p className="w-full text-xs text-muted-foreground">{s.detail}</p>
            ) : null}
          </div>
        ))}
      </div>

      {validationIssues.length > 0 ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <p className="font-medium">Resolve before handoff</p>
          <ul className="mt-1 list-disc pl-5">
            {validationIssues.map((i) => (
              <li key={i.code}>{i.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {!handedOff ? (
        <div className="flex flex-wrap gap-2">
          <form action={startOperatorConfigureAction.bind(null, venueId)}>
            <Button type="submit" variant="outline">
              Configure in Setup Hub
            </Button>
          </form>
          {!confirmOpen ? (
            <Button type="button" onClick={() => setConfirmOpen(true)}>
              Finish White Glove Setup
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="text-sm font-medium text-emerald-700">
          White Glove Setup Complete / Customer Access Pending
        </p>
      )}

      {!handedOff && confirmOpen ? (
          <div className="space-y-3 rounded-md border p-4">
            <h3 className="font-medium">Ready to hand off?</h3>
            <p className="text-sm text-muted-foreground">
              You&apos;ve completed the setup work for this venue.
            </p>
            <p className="text-sm text-muted-foreground">
              Any items you&apos;ve left for the venue owner will be available when they sign
              in.
            </p>
            <p className="text-sm text-muted-foreground">
              Once you finish, we&apos;ll send the owner their access information.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={busy} onClick={finish}>
                {busy ? "Finishing…" : "Finish White Glove Setup"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
      ) : null}
    </div>
  );
}
