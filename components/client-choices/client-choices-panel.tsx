"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  createClientChoicesFromTemplateAction,
  finalizeClientChoicesAction,
  requestClientChoicesChangesAction,
  reviseClientChoicesAction,
  sendClientChoicesAction,
} from "@/app/(app)/events/[id]/client-choices-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  clientChoicesDisplayLabel,
  clientChoicesNextActor,
} from "@/lib/client-choices/constants";
import type { ClientChoices, ClientChoicesWithHistory } from "@/lib/client-choices/types";
import type { ChoicesTemplate } from "@/lib/client-choices-templates/types";

function summarizeAnswers(row: ClientChoices): string {
  const parts: string[] = [];
  for (const group of row.definition.groups) {
    const answer = row.answers[group.id];
    if (!answer?.optionIds?.length) continue;
    const labels = answer.optionIds
      .map((id) => row.definition.options.find((o) => o.id === id)?.label)
      .filter(Boolean);
    if (labels.length) parts.push(`${group.name}: ${labels.join(", ")}`);
  }
  return parts.length ? parts.join(" · ") : "No selections yet";
}

function ChoicesRow({
  eventId,
  row,
}: {
  eventId: string;
  row: ClientChoicesWithHistory | ClientChoices;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [note, setNote] = React.useState("");
  const [showNote, setShowNote] = React.useState(false);
  const actor = clientChoicesNextActor(row.status);
  const submissions = "submissions" in row ? row.submissions : [];

  return (
    <div className="rounded-sm border border-border p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-heading">{row.name}</p>
          <p className="text-xs text-muted-foreground">
            {clientChoicesDisplayLabel(row.status)}
            {actor === "venue" ? " · Venue to act" : actor === "client" ? " · Client to act" : ""}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{summarizeAnswers(row)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {row.status === "draft" ? (
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() => startTransition(async () => {
                const r = await sendClientChoicesAction(eventId, row.id);
                if (!r.ok) toast.error(r.message ?? "Could not send.");
                else { toast.success("Sent to client."); router.refresh(); }
              })}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send to Client"}
            </Button>
          ) : null}
          {(row.status === "submitted" || row.status === "resubmitted") ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => setShowNote((v) => !v)}
              >
                Request Changes
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={() => startTransition(async () => {
                  const r = await finalizeClientChoicesAction(eventId, row.id);
                  if (!r.ok) {
                    toast.error(r.message ?? "Could not finalize.");
                    return;
                  }
                  if (r.financialDelta === 0) {
                    toast.success("Finalized. Event Order updated — no additional cost.");
                  } else {
                    toast.success(
                      `Finalized. Event Order updated (+$${r.financialDelta.toFixed(2)}). Review Invoice / payment plan if needed.`,
                    );
                  }
                  router.refresh();
                })}
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Finalize"}
              </Button>
            </>
          ) : null}
          {row.status === "finalized" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => startTransition(async () => {
                const r = await reviseClientChoicesAction(eventId, row.id);
                if (!r.ok) toast.error(r.message ?? "Could not start revision.");
                else { toast.success("Revision draft created."); router.refresh(); }
              })}
            >
              Revise
            </Button>
          ) : null}
          {(row.status === "sent" || row.status === "in_progress") ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => startTransition(async () => {
                const r = await sendClientChoicesAction(eventId, row.id);
                if (!r.ok) toast.error(r.message ?? "Could not re-send.");
                else { toast.success("Reminder recorded."); router.refresh(); }
              })}
            >
              Re-send
            </Button>
          ) : null}
        </div>
      </div>

      {showNote ? (
        <div className="space-y-2">
          <Textarea
            placeholder="What should the client change?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
          />
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => startTransition(async () => {
              const r = await requestClientChoicesChangesAction(eventId, row.id, note);
              if (!r.ok) toast.error(r.message ?? "Could not request changes.");
              else {
                toast.success("Changes requested.");
                setShowNote(false);
                setNote("");
                router.refresh();
              }
            })}
          >
            Send change request
          </Button>
        </div>
      ) : null}

      {submissions.length > 0 ? (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">Submission history ({submissions.length})</summary>
          <ul className="mt-2 space-y-1 pl-2">
            {submissions.map((s) => (
              <li key={s.id}>
                #{s.submissionNumber} · {s.outcomeStatus} · {s.submittedBy} ·{" "}
                {new Date(s.createdAt).toLocaleString()}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {row.eventOrderId && row.status === "finalized" ? (
        <p className="text-xs text-muted-foreground">
          Applied to Event Order.{" "}
          <span className="text-heading">Amount due still lives on Invoice.</span>
        </p>
      ) : null}
    </div>
  );
}

export function ClientChoicesPanel({
  eventId,
  templates,
  choices,
}: {
  eventId: string;
  templates: ChoicesTemplate[];
  choices: ClientChoicesWithHistory[];
}) {
  const router = useRouter();
  const [templateId, setTemplateId] = React.useState(templates[0]?.id ?? "");
  const [pending, startTransition] = React.useTransition();

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="text-base">Client Choices</CardTitle>
        <CardDescription>
          Post-booking selections (menus, add-ons, rentals). Client submits; you finalize into Event Order — not a second invoice.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No Choices templates yet.{" "}
            <Link href="/library/choices-templates" className="text-primary hover:underline">
              Create one in Library
            </Link>
            .
          </p>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <select
              className="min-w-[220px] rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <Button
              type="button"
              size="sm"
              disabled={pending || !templateId}
              onClick={() => startTransition(async () => {
                const r = await createClientChoicesFromTemplateAction(eventId, templateId);
                if (!r.ok) toast.error(r.message ?? "Could not create.");
                else { toast.success("Client Choices created."); router.refresh(); }
              })}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Choices"}
            </Button>
            <Link href="/library/choices-templates" className="text-xs text-muted-foreground hover:underline self-center">
              Manage templates
            </Link>
          </div>
        )}

        {choices.length === 0 ? (
          <p className="text-sm text-muted-foreground">No Client Choices for this event yet.</p>
        ) : (
          <div className="space-y-3">
            {choices.map((c) => (
              <ChoicesRow key={c.id} eventId={eventId} row={c} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
