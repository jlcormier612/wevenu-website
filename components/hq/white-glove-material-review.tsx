"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import type { MessageImportProposal, PlanningTaskProposal } from "@/lib/onboarding/white-glove-content-import";

type Preview =
  | {
      ok: true;
      kind: "messages";
      fileName: string;
      notes: string[];
      proposals: MessageImportProposal[];
    }
  | {
      ok: true;
      kind: "planning";
      fileName: string;
      notes: string[];
      tasks: PlanningTaskProposal[];
    }
  | { ok: false; message: string };

export function WhiteGloveMaterialReview({
  venueId,
  materialId,
  fileName,
  onClose,
}: {
  venueId: string;
  materialId: string;
  fileName: string;
  onClose: () => void;
}) {
  const [kind, setKind] = React.useState<"messages" | "planning">("messages");
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [templateName, setTemplateName] = React.useState(fileName.replace(/\.[^.]+$/, ""));
  const [playbookKind, setPlaybookKind] = React.useState<"client" | "venue">("client");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<string>("");

  async function load(nextKind: "messages" | "planning") {
    setKind(nextKind);
    setBusy(true);
    setResult("");
    setPreview(null);
    try {
      const res = await fetch("/api/admin/onboarding/white-glove/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ venueId, materialId, kind: nextKind, action: "preview" }),
      });
      const json = (await res.json()) as Preview;
      setPreview(json);
    } catch (err) {
      setPreview({ ok: false, message: err instanceof Error ? err.message : "Could not read the file." });
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!preview || !preview.ok) return;
    setBusy(true);
    setResult("");
    try {
      const res = await fetch("/api/admin/onboarding/white-glove/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          venueId,
          materialId,
          kind: preview.kind,
          action: "apply",
          proposals: preview.kind === "messages" ? preview.proposals : undefined,
          tasks: preview.kind === "planning" ? preview.tasks : undefined,
          templateName,
          playbookKind,
        }),
      });
      const json = await res.json();
      setResult(JSON.stringify(json, null, 2));
    } catch (err) {
      setResult(err instanceof Error ? err.message : "Apply failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-md border p-3" data-testid="wg-material-review">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Review import — {fileName}</p>
        <Button type="button" size="sm" variant="outline" onClick={onClose}>Close</Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Reading the file does not create templates. Confirm apply after you edit or exclude items.
        Existing records with the same name are not overwritten.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant={kind === "messages" ? "default" : "outline"} disabled={busy} onClick={() => void load("messages")}>
          Message templates
        </Button>
        <Button type="button" size="sm" variant={kind === "planning" ? "default" : "outline"} disabled={busy} onClick={() => void load("planning")}>
          Planning checklist
        </Button>
      </div>
      {busy ? <p className="text-xs text-muted-foreground">Working…</p> : null}
      {preview && !preview.ok ? (
        <p className="text-sm text-destructive" data-testid="wg-import-error">{preview.message}</p>
      ) : null}
      {preview && preview.ok ? (
        <div className="space-y-3">
          {preview.notes.map((n) => (
            <p key={n} className="text-xs text-muted-foreground">{n}</p>
          ))}
          {preview.kind === "messages"
            ? preview.proposals.map((p, i) => (
              <div key={`${p.name}-${i}`} className="space-y-1 rounded border p-2 text-sm" data-testid={`wg-msg-proposal-${i}`}>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={p.include}
                    onChange={(e) => {
                      const include = e.target.checked;
                      setPreview({
                        ...preview,
                        proposals: preview.proposals.map((row, idx) => idx === i ? { ...row, include } : row),
                      });
                    }}
                  />
                  Include
                </label>
                <input className="w-full rounded border px-2 py-1" value={p.name} onChange={(e) => {
                  const name = e.target.value;
                  setPreview({ ...preview, proposals: preview.proposals.map((row, idx) => idx === i ? { ...row, name } : row) });
                }} />
                <p className="text-xs text-muted-foreground">Category: {p.category}</p>
                <p className="text-xs">Subject: {p.emailSubject || "(none)"}</p>
                <textarea className="min-h-16 w-full rounded border px-2 py-1 text-xs" value={p.emailBody} onChange={(e) => {
                  const emailBody = e.target.value;
                  setPreview({ ...preview, proposals: preview.proposals.map((row, idx) => idx === i ? { ...row, emailBody } : row) });
                }} />
                {p.warnings.map((w) => <p key={w} className="text-xs text-amber-800">{w}</p>)}
              </div>
            ))
            : (
              <>
                <label className="block text-xs">
                  Template name
                  <input className="mt-1 w-full rounded border px-2 py-1 text-sm" value={templateName} onChange={(e) => setTemplateName(e.target.value)} data-testid="wg-planning-template-name" />
                </label>
                <label className="block text-xs">
                  Checklist
                  <select className="mt-1 rounded border px-2 py-1 text-sm" value={playbookKind} onChange={(e) => setPlaybookKind(e.target.value === "venue" ? "venue" : "client")}>
                    <option value="client">Client planning</option>
                    <option value="venue">Venue planning</option>
                  </select>
                </label>
                {preview.tasks.map((t, i) => (
                  <div key={`${t.sourceLine}-${i}`} className="space-y-1 rounded border p-2 text-sm" data-testid={`wg-plan-proposal-${i}`}>
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={t.include}
                        data-testid={`wg-plan-include-${i}`}
                        onChange={(e) => {
                          const include = e.target.checked;
                          setPreview({ ...preview, tasks: preview.tasks.map((row, idx) => idx === i ? { ...row, include } : row) });
                        }}
                      />
                      Include · {t.milestone}
                    </label>
                    <input className="w-full rounded border px-2 py-1" value={t.title} onChange={(e) => {
                      const title = e.target.value;
                      setPreview({ ...preview, tasks: preview.tasks.map((row, idx) => idx === i ? { ...row, title } : row) });
                    }} />
                    <label className="block text-xs text-muted-foreground">
                      Days relative to the event (negative = before). Leave empty only if you will exclude this item.
                      <input
                        className="mt-1 w-24 rounded border px-2 py-1 text-sm"
                        value={t.daysOffset ?? ""}
                        data-testid={`wg-plan-offset-${i}`}
                        onChange={(e) => {
                          const raw = e.target.value.trim();
                          const daysOffset = raw === "" ? null : Number(raw);
                          setPreview({
                            ...preview,
                            tasks: preview.tasks.map((row, idx) => idx === i ? {
                              ...row,
                              daysOffset: daysOffset != null && Number.isFinite(daysOffset) ? daysOffset : null,
                              timingKnown: row.timingKnown || (raw !== "" && Number.isFinite(Number(raw))),
                            } : row),
                          });
                        }}
                      />
                    </label>
                    {!t.timingKnown ? <p className="text-xs text-amber-800">No timing in the source.</p> : null}
                  </div>
                ))}
              </>
            )}
          <Button type="button" disabled={busy} onClick={() => void apply()} data-testid="wg-import-apply">
            Confirm import
          </Button>
        </div>
      ) : null}
      {result ? <pre className="overflow-auto text-xs" data-testid="wg-import-result">{result}</pre> : null}
    </div>
  );
}
