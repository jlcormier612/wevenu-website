"use client";

import { useEffect, useState, useTransition } from "react";

import { Loader2 } from "lucide-react";

import { ChoicesInteractiveForm } from "@/components/client-choices/choices-interactive-form";
import { Button } from "@/components/ui/button";
import { reconcileAnswersForDependencies } from "@/lib/client-choices/conditional-groups";
import {
  clientChoicesDisplayLabel,
  isClientChoicesClientEditable,
} from "@/lib/client-choices/constants";
import type { ChoicesAnswers, ChoicesDefinition } from "@/lib/client-choices/types";
import { validateChoicesAnswers } from "@/lib/client-choices/validate-answers";
import { pruneAnswersToDefinition } from "@/lib/event-order-templates/selection-definition";

type PortalChoices = {
  id: string;
  name: string;
  status: string;
  definition: ChoicesDefinition;
  answers: ChoicesAnswers;
  changesRequestedNote: string | null;
  sentAt: string | null;
  submittedAt: string | null;
  finalizedAt: string | null;
  eventOrderId: string | null;
};

export function ChoicesPortalSection({ token }: { token: string }) {
  const [rows, setRows] = useState<PortalChoices[] | null | undefined>(undefined);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<ChoicesAnswers>({});
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"info" | "error">("info");

  function applyLoadedAnswers(definition: ChoicesDefinition, raw: ChoicesAnswers | null | undefined) {
    const pruned = pruneAnswersToDefinition(raw ?? {}, definition);
    const reconciled = reconcileAnswersForDependencies(definition, pruned);
    const dropped =
      JSON.stringify(Object.keys(raw ?? {}).sort()) !== JSON.stringify(Object.keys(pruned).sort())
      || Object.keys(raw ?? {}).some((gid) => {
        const before = [...((raw ?? {})[gid]?.optionIds ?? [])].sort().join(",");
        const after = [...(pruned[gid]?.optionIds ?? [])].sort().join(",");
        return before !== after;
      });
    return { answers: reconciled, dropped };
  }

  useEffect(() => {
    fetch(`/api/portal/choices?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d: { choices?: PortalChoices[] }) => {
        const list = d.choices ?? [];
        setRows(list);
        const open = list.find((c) => isClientChoicesClientEditable(c.status)) ?? list[0];
        setActiveId(open?.id ?? null);
        if (open) hydrateAnswers(open);
        else setAnswers({});
      })
      .catch(() => setRows(null));
  }, [token]);

  const active = rows?.find((r) => r.id === activeId) ?? null;

  function hydrateAnswers(row: PortalChoices) {
    const loaded = applyLoadedAnswers(row.definition, row.answers ?? {});
    setAnswers(loaded.answers);
    if (loaded.dropped && isClientChoicesClientEditable(row.status)) {
      setMessageTone("error");
      setMessage(
        "Some of your saved selections are no longer available — review the options below before submitting.",
      );
    }
  }

  if (rows === undefined) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        <div className="animate-pulse">Loading…</div>
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-sm font-medium text-heading">Nothing waiting yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          When your venue sends choices (menus, add-ons, and more), they will appear here.
        </p>
      </div>
    );
  }

  function save(submit: boolean) {
    if (!active) return;
    setMessage(null);
    setMessageTone("info");
    const pruned = pruneAnswersToDefinition(answers, active.definition);
    const reconciled = reconcileAnswersForDependencies(active.definition, pruned);
    if (submit) {
      const validated = validateChoicesAnswers(active.definition, reconciled);
      if (!validated.ok) {
        setMessageTone("error");
        setMessage(validated.message);
        return;
      }
    }
    startTransition(async () => {
      const url = submit ? "/api/portal/choices/submit" : "/api/portal/choices/save";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, choicesId: active.id, answers: reconciled }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMessageTone("error");
        setMessage(data.message ?? "Something went wrong.");
        return;
      }
      setMessageTone("info");
      setMessage(submit ? "Submitted — your venue will review." : "Saved.");
      const refreshed = await fetch(`/api/portal/choices?token=${encodeURIComponent(token)}`).then((r) => r.json());
      const list = (refreshed.choices ?? []) as PortalChoices[];
      setRows(list);
      const current = list.find((c) => c.id === active.id) ?? list[0];
      if (current) hydrateAnswers(current);
    });
  }

  const editable = active ? isClientChoicesClientEditable(active.status) : false;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <div>
        <h1 className="text-xl font-semibold text-heading">Your Choices</h1>
        <p className="text-sm text-muted-foreground">
          Select options your venue asked for. Submitting sends them for review — it is not a payment.
        </p>
      </div>

      {rows.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {rows.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`rounded-full border px-3 py-1 text-xs ${r.id === activeId ? "border-heading bg-muted" : "border-border"}`}
              onClick={() => {
                setActiveId(r.id);
                hydrateAnswers(r);
              }}
            >
              {r.name}
            </button>
          ))}
        </div>
      ) : null}

      {active ? (
        <div className="space-y-4">
          <div className="rounded-sm border border-border bg-muted/20 px-3 py-2 text-sm">
            <span className="font-medium">{active.name}</span>
            <span className="text-muted-foreground"> · {clientChoicesDisplayLabel(active.status)}</span>
            {active.changesRequestedNote ? (
              <p className="mt-1 text-xs text-muted-foreground">Venue note: {active.changesRequestedNote}</p>
            ) : null}
          </div>

          <ChoicesInteractiveForm
            definition={active.definition}
            answers={answers}
            editable={editable}
            onAnswersChange={(next) => {
              setAnswers(next);
              setMessage(null);
              setMessageTone("info");
            }}
            onBlocked={(blocked) => {
              if (blocked) {
                setMessageTone("error");
                setMessage(blocked);
              } else {
                setMessage(null);
                setMessageTone("info");
              }
            }}
          />

          {message ? (
            <p
              className={`text-sm ${messageTone === "error" ? "text-destructive" : "text-muted-foreground"}`}
              data-testid={messageTone === "error" ? "portal-choices-error" : "portal-choices-message"}
              role={messageTone === "error" ? "alert" : undefined}
            >
              {message}
            </p>
          ) : null}

          {editable ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                data-testid="portal-choices-save"
                onClick={() => save(false)}
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
              <Button
                type="button"
                disabled={pending}
                data-testid="portal-choices-submit"
                onClick={() => save(true)}
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
              </Button>
            </div>
          ) : active.status === "finalized" ? (
            <p className="text-sm text-muted-foreground" data-testid="portal-choices-finalized">
              These choices are finalized and part of your event record.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground" data-testid="portal-choices-submitted">
              Submitted — waiting for your venue to review.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
