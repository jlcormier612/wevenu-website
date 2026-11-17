"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { sendPracticeVenueMessageAction } from "@/app/(app)/setup-hub/practice-run/actions";
import { Button } from "@/components/ui/button";
import type { PracticeConversationMessage } from "@/lib/practice-run/conversation-service";
import type { PracticeRun } from "@/lib/practice-run/types";

export function PracticeConversationPanel({
  run,
  messages,
}: {
  run: PracticeRun;
  messages: PracticeConversationMessage[];
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);
  const clientHref = `/practice-run/${encodeURIComponent(run.id)}/client?view=messages`;

  async function onSend() {
    const form = formRef.current;
    const text = form ? String(new FormData(form).get("body") ?? "").trim() : "";
    if (busy) return;
    if (!text) {
      toast.error("Write a message before sending.");
      return;
    }
    setBusy(true);
    try {
      const result = await sendPracticeVenueMessageAction({ runId: run.id, body: text });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      formRef.current?.reset();
      toast.success("Message shared in Practice Run. Switch to Client to see it.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="space-y-3 rounded-xl border border-border bg-card px-4 py-4 sm:px-5"
      data-testid="practice-conversation-panel"
    >
      <div className="space-y-1">
        <h2 className="font-heading text-xl font-medium text-heading">Practice conversation</h2>
        <p className="text-sm text-muted-foreground">
          Write as the venue, then open the Client perspective to reply. Messages stay inside
          Practice Run — nothing is emailed or texted.
        </p>
      </div>

      <div
        className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-border bg-muted/15 px-3 py-3"
        data-testid="practice-conversation-thread"
      >
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages yet. Send the first one below.</p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`rounded-md px-3 py-2 text-sm ${
                m.sender === "venue" ? "bg-primary/10 text-heading" : "bg-card text-heading"
              }`}
              data-testid={`practice-message-${m.sender}`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {m.sender === "venue" ? "Venue" : "Maya & Jordan"} ·{" "}
                {new Date(m.sentAt).toLocaleString()}
              </p>
              <p className="mt-0.5 whitespace-pre-wrap">{m.body}</p>
            </div>
          ))
        )}
      </div>

      <form
        ref={formRef}
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void onSend();
        }}
        data-testid="practice-venue-message-form"
      >
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-heading">Message as venue</span>
          <textarea
            name="body"
            className="min-h-[72px] w-full rounded-md border border-border bg-background px-3 py-2"
            placeholder="Hi Maya and Jordan — welcome to your planning workspace."
            data-testid="practice-venue-message-input"
          />
        </label>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            disabled={busy}
            onClick={() => void onSend()}
            data-testid="practice-send-venue-message"
          >
            {busy ? "Sending…" : "Send in Practice Run"}
          </Button>
          <Button
            type="button"
            variant="outline"
            render={<a href={clientHref} data-testid="practice-open-client-messages" />}
          >
            Open Client messages
          </Button>
        </div>
      </form>
    </section>
  );
}
