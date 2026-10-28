"use client";

import { useEffect, useState, useTransition } from "react";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  orderedVisibleChoiceGroups,
  reconcileAnswersForDependencies,
} from "@/lib/client-choices/conditional-groups";
import {
  clientChoicesDisplayLabel,
  isClientChoicesClientEditable,
} from "@/lib/client-choices/constants";
import type { ChoicesAnswers, ChoicesDefinition } from "@/lib/client-choices/types";
import {
  isAtSelectionMaximum,
  selectionMaximumReachedMessage,
  selectionProgressForGroup,
} from "@/lib/client-choices/selection-progress";
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
        if (open) {
          const loaded = applyLoadedAnswers(open.definition, open.answers ?? {});
          setAnswers(loaded.answers);
          if (loaded.dropped && isClientChoicesClientEditable(open.status)) {
            setMessageTone("error");
            setMessage(
              "Some of your saved selections are no longer available — review the options below before submitting.",
            );
          }
        } else {
          setAnswers({});
        }
      })
      .catch(() => setRows(null));
  }, [token]);

  const active = rows?.find((r) => r.id === activeId) ?? null;

  useEffect(() => {
    if (active) {
      const loaded = applyLoadedAnswers(active.definition, active.answers ?? {});
      setAnswers(loaded.answers);
      if (loaded.dropped && isClientChoicesClientEditable(active.status)) {
        setMessageTone("error");
        setMessage(
          "Some of your saved selections are no longer available — review the options below before submitting.",
        );
      }
    }
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
    if (!active) return;
    const group = active.definition.groups.find((g) => g.id === groupId);
    const current = answers[groupId]?.optionIds ?? [];
    const alreadySelected = current.includes(optionId);

    // Adding a new multi selection past max — block without replacing silently.
    if (group && mode === "multi" && !alreadySelected && isAtSelectionMaximum(group, current.length)) {
      setMessageTone("error");
      setMessage(selectionMaximumReachedMessage(group));
      return;
    }

    setMessage(null);
    setMessageTone("info");
    setAnswers((prev) => {
      const cur = prev[groupId]?.optionIds ?? [];
      let next: string[];
      if (mode === "single") {
        next = cur.includes(optionId) ? [] : [optionId];
      } else {
        next = cur.includes(optionId)
          ? cur.filter((id) => id !== optionId)
          : [...cur, optionId];
      }
      const tentative = { ...prev, [groupId]: { ...prev[groupId], optionIds: next } };
      return reconcileAnswersForDependencies(active.definition, tentative);
    });
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
      setRows(refreshed.choices ?? []);
    });
  }

  const editable = active ? isClientChoicesClientEditable(active.status) : false;
  const visibleGroups = active
    ? orderedVisibleChoiceGroups(active.definition, answers)
    : [];

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

          {(active.definition.fixedLines?.length ?? 0) > 0 ? (
            <div
              className="space-y-4 rounded-sm border border-border bg-muted/15 p-4"
              data-testid="choices-definition-view"
              data-mode="portal-fixed"
            >
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Included with your event
              </p>
              {(() => {
                const fixed = active.definition.fixedLines!.slice();
                const sections = active.definition.sections
                  .slice()
                  .sort((a, b) => a.sortOrder - b.sortOrder);
                const bySection = sections
                  .map((section) => ({
                    section,
                    lines: fixed
                      .filter((l) => l.sectionId === section.id)
                      .sort((a, b) => a.sortOrder - b.sortOrder),
                  }))
                  .filter((entry) => entry.lines.length > 0);
                const unsectioned = fixed
                  .filter((l) => !l.sectionId || sections.every((s) => s.id !== l.sectionId))
                  .sort((a, b) => a.sortOrder - b.sortOrder);
                const blocks =
                  bySection.length > 0
                    ? bySection.map(({ section, lines }) => ({
                        key: section.id,
                        title: section.name,
                        guidance: section.guidance,
                        lines,
                      }))
                    : [
                        {
                          key: "included",
                          title: null as string | null,
                          guidance: null as string | null,
                          lines: fixed.sort((a, b) => a.sortOrder - b.sortOrder),
                        },
                      ];
                if (unsectioned.length > 0 && bySection.length > 0) {
                  blocks.push({
                    key: "unsectioned",
                    title: null,
                    guidance: null,
                    lines: unsectioned,
                  });
                }
                return blocks.map((block) => (
                  <section key={block.key} className="space-y-2">
                    {block.title ? (
                      <h2 className="text-sm font-semibold text-heading">{block.title}</h2>
                    ) : null}
                    {block.guidance ? (
                      <p className="text-xs text-muted-foreground">{block.guidance}</p>
                    ) : null}
                    <ul className="space-y-2">
                      {block.lines.map((line) => (
                        <li key={line.id} className="text-sm" data-testid="choices-fixed-line">
                          <span className="font-medium text-heading">{line.description}</span>
                          {line.descriptionDetail ? (
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {line.descriptionDetail}
                            </span>
                          ) : null}
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {line.includedByDefault ? "Included" : "Part of your offering"}
                            {line.unitPrice != null
                              ? ` · $${Number(line.unitPrice).toFixed(2)}`
                              : ""}
                            {line.unit ? ` / ${line.unit}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ));
              })()}
            </div>
          ) : null}

          {visibleGroups.map((group) => {
            const deps = group.dependsOnOptionIds ?? [];
            const isDependent = deps.length > 0;
            const opts = active.definition.options
              .filter((o) => o.groupId === group.id)
              .sort((a, b) => a.sortOrder - b.sortOrder);
            const selected = answers[group.id]?.optionIds ?? [];
            const progress = selectionProgressForGroup(group, selected.length);
            const atMax = progress.atMaximum;
            return (
              <fieldset
                key={group.id}
                className={`space-y-2 rounded-sm border border-border p-4 ${isDependent ? "ml-3 border-l-2 border-l-heading/40" : ""}`}
                disabled={!editable}
                data-testid={isDependent ? "choices-dependent-group" : "choices-group"}
                data-group-name={group.name}
                data-dependent={isDependent ? "true" : "false"}
                data-selected-count={String(progress.selectedCount)}
                data-at-maximum={atMax ? "true" : "false"}
              >
                <legend className="px-1 text-sm font-medium text-heading">{group.name}</legend>
                <p
                  className="text-xs text-muted-foreground"
                  data-testid="choices-group-progress"
                >
                  {progress.label}
                  {isDependent ? " · based on your selection above" : ""}
                </p>
                {/* Legacy harness seam — same live progress text */}
                <span className="sr-only" data-testid="choices-group-rules">{progress.label}</span>
                {group.instructions ? (
                  <p className="text-xs text-muted-foreground">{group.instructions}</p>
                ) : null}
                {opts.length === 0 ? (
                  <p className="text-xs text-muted-foreground" data-testid="choices-dependent-empty">
                    No additional choices are configured for this selection yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {opts.map((opt) => {
                      const checked = selected.includes(opt.id);
                      const blockedAdd = atMax && !checked && group.selectionMode === "multi";
                      return (
                        <label
                          key={opt.id}
                          className={`flex items-start gap-3 rounded-sm border px-3 py-2 text-sm ${
                            checked
                              ? "cursor-pointer border-heading bg-muted/30"
                              : blockedAdd
                                ? "cursor-not-allowed border-border opacity-60"
                                : "cursor-pointer border-border"
                          }`}
                        >
                          <input
                            type={group.selectionMode === "single" ? "radio" : "checkbox"}
                            name={group.id}
                            value={opt.id}
                            checked={checked}
                            disabled={!editable || blockedAdd}
                            aria-disabled={blockedAdd || undefined}
                            title={blockedAdd ? selectionMaximumReachedMessage(group) : undefined}
                            data-testid={`choices-option-${opt.id}`}
                            data-option-id={opt.id}
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
                )}
              </fieldset>
            );
          })}

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
