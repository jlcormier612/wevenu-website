"use client";

import { useEffect, useState, useTransition } from "react";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  clientChoicesDisplayLabel,
  isClientChoicesClientEditable,
} from "@/lib/client-choices/constants";
import type { ChoicesAnswers, ChoicesDefinition } from "@/lib/client-choices/types";

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

  useEffect(() => {
    fetch(`/api/portal/choices?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d: { choices?: PortalChoices[] }) => {
        const list = d.choices ?? [];
        setRows(list);
        const open = list.find((c) => isClientChoicesClientEditable(c.status)) ?? list[0];
        setActiveId(open?.id ?? null);
        setAnswers(open?.answers ?? {});
      })
      .catch(() => setRows(null));
  }, [token]);

  const active = rows?.find((r) => r.id === activeId) ?? null;

  useEffect(() => {
    if (active) setAnswers(active.answers ?? {});
  }, [active?.id]);

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

  function toggleOption(groupId: string, optionId: string, mode: "single" | "multi") {
    setAnswers((prev) => {
      const current = prev[groupId]?.optionIds ?? [];
      let next: string[];
      if (mode === "single") {
        next = current.includes(optionId) ? [] : [optionId];
      } else {
        next = current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId];
      }
      return { ...prev, [groupId]: { ...prev[groupId], optionIds: next } };
    });
  }

  function save(submit: boolean) {
    if (!active) return;
    setMessage(null);
    startTransition(async () => {
      const url = submit ? "/api/portal/choices/submit" : "/api/portal/choices/save";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, choicesId: active.id, answers }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMessage(data.message ?? "Something went wrong.");
        return;
      }
      setMessage(submit ? "Submitted — your venue will review." : "Saved.");
      const refreshed = await fetch(`/api/portal/choices?token=${encodeURIComponent(token)}`).then((r) => r.json());
      setRows(refreshed.choices ?? []);
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
              onClick={() => setActiveId(r.id)}
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

          {active.definition.groups
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((group) => {
              const opts = active.definition.options
                .filter((o) => o.groupId === group.id)
                .sort((a, b) => a.sortOrder - b.sortOrder);
              const selected = answers[group.id]?.optionIds ?? [];
              return (
                <fieldset key={group.id} className="space-y-2 rounded-sm border border-border p-4" disabled={!editable}>
                  <legend className="px-1 text-sm font-medium text-heading">{group.name}</legend>
                  {group.instructions ? (
                    <p className="text-xs text-muted-foreground">{group.instructions}</p>
                  ) : null}
                  <div className="space-y-2">
                    {opts.map((opt) => {
                      const checked = selected.includes(opt.id);
                      return (
                        <label
                          key={opt.id}
                          className={`flex cursor-pointer items-start gap-3 rounded-sm border px-3 py-2 text-sm ${checked ? "border-heading bg-muted/30" : "border-border"}`}
                        >
                          <input
                            type={group.selectionMode === "single" ? "radio" : "checkbox"}
                            name={group.id}
                            checked={checked}
                            onChange={() => toggleOption(group.id, opt.id, group.selectionMode)}
                            className="mt-0.5"
                          />
                          <span className="flex-1">
                            <span className="font-medium">{opt.label}</span>
                            {opt.description ? (
                              <span className="block text-xs text-muted-foreground">{opt.description}</span>
                            ) : null}
                            <span className="block text-xs text-muted-foreground">
                              {opt.isIncluded
                                ? "Included"
                                : opt.unitPrice != null
                                  ? `+$${Number(opt.unitPrice).toFixed(2)}`
                                  : "Additional"}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              );
            })}

          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

          {editable ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={pending} onClick={() => save(false)}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
              <Button type="button" disabled={pending} onClick={() => save(true)}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
              </Button>
            </div>
          ) : active.status === "finalized" ? (
            <p className="text-sm text-muted-foreground">
              These choices are finalized and part of your event record.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Submitted — waiting for your venue to review.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
