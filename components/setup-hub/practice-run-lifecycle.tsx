"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  finishPracticeRunAction,
  resetPracticeRunAction,
} from "@/app/(app)/setup-hub/practice-run/actions";
import { Button } from "@/components/ui/button";
import {
  isPracticeJourneyComplete,
} from "@/lib/practice-run/journey";
import {
  PRACTICE_FINISH_COPY,
  PRACTICE_RESET_CONFIRM_COPY,
} from "@/lib/practice-run/lifecycle-copy";
import type { PracticeRun } from "@/lib/practice-run/types";

export function PracticeRunLifecyclePanel({ run }: { run: PracticeRun }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<"finish" | "reset" | null>(null);
  const [confirmReset, setConfirmReset] = React.useState(false);
  const journeyComplete = isPracticeJourneyComplete(run.journey);
  const finished = Boolean(run.journey.finishedAt);

  async function onFinish() {
    setBusy("finish");
    try {
      const result = await finishPracticeRunAction({ runId: run.id });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Saved — head back to Setup when you’re ready.");
      router.push("/setup-hub/take-a-look?practiceFinished=1");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function onReset() {
    setBusy("reset");
    try {
      const result = await resetPracticeRunAction({ runId: run.id });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setConfirmReset(false);
      toast.success(result.message ?? "Practice Run refreshed.");
      router.replace(`/setup-hub/practice-run?run=${encodeURIComponent(result.runId)}&practiceReset=1`);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section
      className="space-y-4 rounded-xl border border-border bg-card px-4 py-5 sm:px-5"
      data-testid="practice-run-lifecycle-panel"
    >
      <div className="space-y-2">
        <h2 className="font-heading text-xl font-medium text-heading" data-testid="practice-lifecycle-heading">
          {journeyComplete || finished
            ? PRACTICE_FINISH_COPY.title
            : "Finish for now, or start over"}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground" data-testid="practice-lifecycle-body">
          {journeyComplete || finished
            ? PRACTICE_FINISH_COPY.body
            : "Return to Setup anytime — Practice Run is optional, not a gate. Or start over with a clean sample celebration if you want another walkthrough."}
        </p>
      </div>

      {!confirmReset ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            disabled={busy !== null}
            onClick={() => void onFinish()}
            data-testid="practice-finish-return-setup"
          >
            {busy === "finish" ? "Saving…" : PRACTICE_FINISH_COPY.primary}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy !== null}
            render={<Link href="/setup-hub" data-testid="practice-lifecycle-stay-setup-hub" />}
          >
            Open Setup Hub
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy !== null}
            onClick={() => setConfirmReset(true)}
            data-testid="practice-reset-start-over"
          >
            Start over
          </Button>
        </div>
      ) : (
        <div
          className="space-y-3 rounded-lg border border-border bg-muted/15 px-3 py-3"
          data-testid="practice-reset-confirm"
          role="alertdialog"
          aria-labelledby="practice-reset-confirm-title"
          aria-describedby="practice-reset-confirm-body"
        >
          <p id="practice-reset-confirm-title" className="font-medium text-heading">
            {PRACTICE_RESET_CONFIRM_COPY.title}
          </p>
          <p id="practice-reset-confirm-body" className="text-sm text-muted-foreground">
            {PRACTICE_RESET_CONFIRM_COPY.body}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              disabled={busy !== null}
              onClick={() => void onReset()}
              data-testid="practice-reset-confirm-yes"
            >
              {busy === "reset" ? "Starting over…" : PRACTICE_RESET_CONFIRM_COPY.confirm}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy !== null}
              onClick={() => setConfirmReset(false)}
              data-testid="practice-reset-confirm-cancel"
            >
              {PRACTICE_RESET_CONFIRM_COPY.cancel}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
