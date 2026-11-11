"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  approveEventOrderDocumentAction,
  saveEventOrderDocumentAnswersAction,
} from "@/app/order/actions";
import { EventOrderDocumentView } from "@/components/event-orders/event-order-document-view";
import type { ChoicesAnswers } from "@/lib/client-choices/types";
import type { CoupleDocumentView } from "@/lib/event-orders/couple-document";

const AUTOSAVE_DELAY_MS = 600;

/** Couple Event Order on /order/{token}: autosaved picks → one Approve. */
export function EventOrderDocumentClient({
  token,
  doc,
}: {
  token: string;
  doc: CoupleDocumentView;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [saveState, setSaveState] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = React.useRef<Promise<unknown> | null>(null);
  const choicesId = doc.choices?.id ?? null;

  React.useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function handleAnswersChange(answers: ChoicesAnswers) {
    if (!choicesId) return;
    if (timer.current) clearTimeout(timer.current);
    setSaveState("saving");
    timer.current = setTimeout(() => {
      const run = saveEventOrderDocumentAnswersAction(token, choicesId, answers).then((result) => {
        setSaveState(result.ok ? "saved" : "error");
      });
      saving.current = run;
    }, AUTOSAVE_DELAY_MS);
  }

  function handleApprove(answers: ChoicesAnswers) {
    if (timer.current) clearTimeout(timer.current);
    startTransition(async () => {
      await saving.current;
      const result = await approveEventOrderDocumentAction(token, doc.choices ? answers : null);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Thank you — your Event Order is approved.");
      router.refresh();
    });
  }

  return (
    <EventOrderDocumentView
      doc={doc}
      mode="live"
      pending={pending}
      saveState={saveState}
      onAnswersChange={handleAnswersChange}
      onApprove={handleApprove}
    />
  );
}
