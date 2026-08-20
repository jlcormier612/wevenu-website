"use client";

/**
 * Migration Center — self-service V1 (docs/migration-cutover-architecture.md).
 *
 * Deliberately a simpler, separate flow from components/settings/
 * import-wizard.tsx rather than a rework of it — that wizard's one-shot,
 * synchronous, no-dedupe-review commit is exactly right for a venue adding
 * a handful of records today; this one is for "bring my whole business
 * over," where recognizing duplicates and reviewing them before anything
 * is created is the entire point. Both call the same canonical entity-
 * create functions underneath; neither is a second domain model.
 *
 * Migration is not a one-hour task — a venue may start it, leave, and come
 * back days later. Every session in history is independently resumable:
 * clicking one reads its actual current state (lib/migration/service.ts's
 * getOwnSessionResumeState) and renders exactly the next step, never a
 * blank slate and never a re-upload prompt.
 */
import * as React from "react";
import Papa from "papaparse";
import { AlertTriangle, CheckCircle2, Download, FileText, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/integrations/supabase/client";
import {
  addMigrationRowsAction,
  attachMigrationSourceFileAction,
  commitMigrationSessionAction,
  getMigrationSessionRecordsAction,
  getMigrationSessionResumeStateAction,
  getMigrationSessionSourceFilesAction,
  listMigrationSessionsAction,
  reviewMigrationRecordAction,
  runMigrationDedupeAction,
  startMigrationSessionAction,
} from "@/app/(app)/settings/migration-actions";
import type {
  MigrationEntityType, MigrationRecord, MigrationSession, SessionResumeState, SessionSourceFile, SessionSummary, SourceKey, SourceProfile,
} from "@/lib/migration/types";

type CsvRow = Record<string, string>;

const ENTITY_LABEL: Record<MigrationEntityType, string> = {
  client: "Clients (booked couples)", lead: "Leads (open inquiries)", vendor: "Vendors",
  event: "Events", payment: "Payments", document: "Documents",
};
const COMMITTABLE_ENTITIES: MigrationEntityType[] = ["client", "lead", "vendor"];

const FIELD_KEYS_BY_ENTITY: Record<MigrationEntityType, { key: string; label: string; required: boolean }[]> = {
  client: [
    { key: "firstName", label: "First name", required: true },
    { key: "lastName", label: "Last name", required: true },
    { key: "partnerFirstName", label: "Partner first name", required: false },
    { key: "partnerLastName", label: "Partner last name", required: false },
    { key: "email", label: "Email", required: false },
    { key: "phone", label: "Phone", required: false },
    { key: "eventDate", label: "Event date (YYYY-MM-DD)", required: false },
    { key: "eventType", label: "Event type", required: false },
    { key: "guestCount", label: "Guest count", required: false },
    { key: "internalNotes", label: "Notes", required: false },
    { key: "sourceId", label: "Their own record ID (if the export has one)", required: false },
  ],
  lead: [
    { key: "firstName", label: "First name", required: true },
    { key: "lastName", label: "Last name", required: true },
    { key: "email", label: "Email", required: false },
    { key: "phone", label: "Phone", required: false },
    { key: "eventDate", label: "Event date (YYYY-MM-DD)", required: false },
    { key: "eventType", label: "Event type", required: false },
    { key: "estimatedBudget", label: "Budget", required: false },
    { key: "inquiryMessage", label: "Inquiry notes", required: false },
    { key: "sourceId", label: "Their own record ID (if the export has one)", required: false },
  ],
  vendor: [
    { key: "businessName", label: "Business name", required: true },
    { key: "category", label: "Category", required: false },
    { key: "contactName", label: "Contact name", required: false },
    { key: "email", label: "Email", required: false },
    { key: "phone", label: "Phone", required: false },
    { key: "websiteUrl", label: "Website", required: false },
    { key: "notes", label: "Notes", required: false },
    { key: "sourceId", label: "Their own record ID (if the export has one)", required: false },
  ],
  event: [], payment: [], document: [],
};

const NEEDS_DECISION_STATUSES = ["duplicate_likely", "conflict", "needs_review"] as const;

/** Plain-language status, computed from the session's actual current state — never the raw enum. */
function humanStatus(state: SessionResumeState | null, session: MigrationSession): { label: string; tone: "success" | "warning" | "destructive" | "outline" } {
  if (session.status === "failed" && state !== "partially_done") return { label: "Something went wrong", tone: "destructive" };
  if (session.status === "abandoned") return { label: "Stopped", tone: "outline" };
  switch (state) {
    case "empty":
    case "needs_processing": return { label: "Uploaded — not yet reviewed", tone: "outline" };
    case "needs_review": return { label: "Needs your attention", tone: "warning" };
    case "ready_to_commit": return { label: "Ready to import", tone: "outline" };
    case "partially_done": return { label: "Partly imported — some records need attention", tone: "warning" };
    case "done": return { label: "Complete", tone: "success" };
    default: return { label: "In progress", tone: "outline" };
  }
}

function formatBytes(n: number | null): string {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "success" | "warning" | "destructive" | "outline" }> = {
    validated: { label: "Ready", variant: "success" },
    approved: { label: "Approved", variant: "success" },
    committed: { label: "Imported", variant: "success" },
    duplicate_exact: { label: "Already exists — will skip", variant: "outline" },
    duplicate_likely: { label: "Possible duplicate", variant: "warning" },
    conflict: { label: "Needs a decision", variant: "warning" },
    needs_review: { label: "Couldn't read this row", variant: "destructive" },
    rejected: { label: "Skipped", variant: "outline" },
    skipped: { label: "Skipped", variant: "outline" },
  };
  const m = map[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

/** Plain-language outcome sentence for a summary's counts — the "did everything make it in?" answer. */
function outcomeSentence(summary: SessionSummary): string {
  const c = summary.counts;
  const parts: string[] = [];
  if (c.committed > 0) parts.push(`${c.committed} imported`);
  if (c.duplicate_exact + c.skipped > 0) parts.push(`${c.duplicate_exact + c.skipped} already in Hello to Cheers`);
  const needsAttention = c.duplicate_likely + c.conflict + c.needs_review;
  if (needsAttention > 0) parts.push(`${needsAttention} need${needsAttention === 1 ? "s" : ""} your attention`);
  if (c.rejected > 0) parts.push(`${c.rejected} skipped by you`);
  if (parts.length === 0) return "Nothing recognized yet.";
  return parts.join(" · ");
}

export function MigrationCenter({ sourceProfiles }: { sourceProfiles: SourceProfile[] }) {
  const [sessions, setSessions] = React.useState<MigrationSession[]>([]);
  const [activeSessionId, setActiveSessionId] = React.useState<string | null>(null);
  const [resume, setResume] = React.useState<{ state: SessionResumeState; summary: SessionSummary } | null>(null);
  const [decisionRecords, setDecisionRecords] = React.useState<MigrationRecord[]>([]);
  const [sourceFiles, setSourceFiles] = React.useState<SessionSourceFile[]>([]);
  const [loading, startLoading] = React.useTransition();
  const [starting, setStarting] = React.useState(false);

  const [sourceKey, setSourceKey] = React.useState<SourceKey>("generic_csv");
  const [entityType, setEntityType] = React.useState<MigrationEntityType>("client");
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [rows, setRows] = React.useState<CsvRow[]>([]);
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const [mapping, setMapping] = React.useState<Record<string, string>>({});
  const fileRef = React.useRef<HTMLInputElement>(null);

  const selectedProfile = sourceProfiles.find((p) => p.key === sourceKey) ?? sourceProfiles[0];
  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

  const refreshSessions = React.useCallback(() => {
    startLoading(async () => setSessions(await listMigrationSessionsAction()));
  }, []);

  React.useEffect(() => { refreshSessions(); }, [refreshSessions]);

  const openSession = React.useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    startLoading(async () => {
      const [resumeState, files] = await Promise.all([
        getMigrationSessionResumeStateAction(sessionId),
        getMigrationSessionSourceFilesAction(sessionId),
      ]);
      setResume(resumeState);
      setSourceFiles(files);
      if (resumeState && (resumeState.state === "needs_review" || resumeState.state === "partially_done")) {
        const needsDecision = (await Promise.all(NEEDS_DECISION_STATUSES.map((status) => getMigrationSessionRecordsAction(sessionId, status)))).flat();
        setDecisionRecords(needsDecision as MigrationRecord[]);
      } else {
        setDecisionRecords([]);
      }
    });
  }, []);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    Papa.parse<CsvRow>(file, {
      header: true, skipEmptyLines: true,
      complete: (results) => {
        const hs = results.meta.fields ?? [];
        setHeaders(hs);
        setRows(results.data);
        const fields = FIELD_KEYS_BY_ENTITY[entityType];
        const auto: Record<string, string> = {};
        for (const f of fields) {
          const found = hs.find((h) => h.trim().toLowerCase() === f.label.toLowerCase() || h.trim().toLowerCase() === f.key.toLowerCase());
          if (found) auto[f.key] = found;
        }
        setMapping(auto);
        toast.success(`Read ${results.data.length} rows from ${file.name}.`);
      },
      error: () => toast.error("Could not read that file."),
    });
  }

  async function uploadSourceFile(sessionId: string, file: File) {
    try {
      const supabase = createClient();
      const docId = crypto.randomUUID();
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "csv";
      // Same storage architecture components/document-workspace/upload-
      // button.tsx already uses (the `documents` bucket, an unguessable
      // random path) — a migration source file is stored as an ordinary,
      // venue-level document, not a parallel storage system. sessionId and
      // docId are both random UUIDs, so this path is not enumerable —
      // matching every other document in this bucket's own security model.
      const fullPath = `migration/${sessionId}/${docId}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("documents").upload(fullPath, file, { upsert: false, contentType: file.type });
      if (uploadError) { toast.error("Could not save the original file, but your data was still read and imported."); return; }
      const { data: urlData } = supabase.storage.from("documents").getPublicUrl(fullPath);
      await attachMigrationSourceFileAction(sessionId, {
        fileName: file.name, fileSize: file.size, mimeType: file.type, storagePath: fullPath, storageUrl: urlData.publicUrl,
      });
    } catch {
      toast.error("Could not save the original file, but your data was still read and imported.");
    }
  }

  async function handleStartAndUpload() {
    if (rows.length === 0) { toast.error("Choose a file first."); return; }
    setStarting(true);
    try {
      const started = await startMigrationSessionAction(sourceKey);
      if (!started.ok) { toast.error(started.message); return; }
      if (pendingFile) await uploadSourceFile(started.session.id, pendingFile);
      const sourceRows = rows.map((row) => {
        const mapped: Record<string, string | null> = {};
        for (const [key, col] of Object.entries(mapping)) mapped[key] = (row[col] ?? "").trim() || null;
        return mapped;
      });
      const added = await addMigrationRowsAction(started.session.id, entityType, sourceRows);
      if (!added.ok) { toast.error(added.message); return; }
      const deduped = await runMigrationDedupeAction(started.session.id);
      if (!deduped.ok) { toast.error(deduped.message); return; }
      toast.success("Files recognized and checked for duplicates — review below.");
      setRows([]); setHeaders([]); setMapping({}); setPendingFile(null);
      if (fileRef.current) fileRef.current.value = "";
      refreshSessions();
      openSession(started.session.id);
    } finally {
      setStarting(false);
    }
  }

  function handleContinueProcessing(sessionId: string) {
    startLoading(async () => {
      const result = await runMigrationDedupeAction(sessionId);
      if (!result.ok) { toast.error(result.message); return; }
      openSession(sessionId);
      refreshSessions();
    });
  }

  function handleDecision(sessionId: string, recordId: string, decision: "approve" | "reject") {
    startLoading(async () => {
      const result = await reviewMigrationRecordAction(sessionId, recordId, decision);
      if (result.ok) openSession(sessionId);
      else toast.error(result.message);
    });
  }

  function handleCommit(sessionId: string) {
    startLoading(async () => {
      const result = await commitMigrationSessionAction(sessionId);
      if (!result.ok) { toast.error(result.message); return; }
      toast.success(`Imported ${result.outcome.committed}, skipped ${result.outcome.skipped}${result.outcome.failed ? `, ${result.outcome.failed} need another look` : ""}.`);
      openSession(sessionId);
      refreshSessions();
    });
  }

  const pendingCommitCount = resume ? resume.summary.counts.validated + resume.summary.counts.approved : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Where are you moving from?</CardTitle>
          <CardDescription>
            We'll recognize what we can from the file you upload — this never connects to or logs into another platform on your behalf.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-heading">Source</p>
              <Select value={sourceKey} onValueChange={(v) => setSourceKey(v as SourceKey)} items={sourceProfiles.map((p) => ({ value: p.key, label: p.displayName }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{sourceProfiles.map((p) => <SelectItem key={p.key} value={p.key}>{p.displayName}</SelectItem>)}</SelectContent>
              </Select>
              {selectedProfile?.historicalLimitations && (
                <p className="text-[11px] text-muted-foreground">{selectedProfile.historicalLimitations}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-heading">What are you bringing over?</p>
              <Select value={entityType} onValueChange={(v) => setEntityType(v as MigrationEntityType)} items={COMMITTABLE_ENTITIES.map((e) => ({ value: e, label: ENTITY_LABEL[e] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{COMMITTABLE_ENTITIES.map((e) => <SelectItem key={e} value={e}>{ENTITY_LABEL[e]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-border p-4">
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="text-sm" />
            <p className="mt-1 text-[11px] text-muted-foreground">CSV export from {selectedProfile?.displayName ?? "your old system"}. We'll keep a copy of this file with your migration history.</p>
          </div>

          {headers.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Match your columns</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {FIELD_KEYS_BY_ENTITY[entityType].map((f) => (
                  <div key={f.key} className="flex items-center gap-2">
                    <label className="w-40 shrink-0 text-xs text-muted-foreground">{f.label}{f.required && " *"}</label>
                    <Select value={mapping[f.key] ?? "__none__"} onValueChange={(v) => setMapping((m) => ({ ...m, [f.key]: v === "__none__" ? "" : v }))} items={[{ value: "__none__", label: "Don't import" }, ...headers.map((h) => ({ value: h, label: h }))]}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Don't import</SelectItem>
                        {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <Button size="sm" onClick={handleStartAndUpload} disabled={starting}>
                  {starting ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Working…</> : <><Upload className="mr-1.5 h-3.5 w-3.5" />Bring in {rows.length} row{rows.length === 1 ? "" : "s"}</>}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {activeSession && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">
                {sourceProfiles.find((p) => p.key === activeSession.sourceKey)?.displayName ?? activeSession.sourceKey}
              </CardTitle>
              {resume && <StatusPill state={resume.state} session={activeSession} />}
            </div>
            <CardDescription>
              Started {new Date(activeSession.startedAt).toLocaleDateString()} · last activity {new Date(activeSession.lastActivityAt).toLocaleDateString()}
              {resume && <> · {outcomeSentence(resume.summary)}</>}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {sourceFiles.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Original file{sourceFiles.length === 1 ? "" : "s"}</p>
                {sourceFiles.map((f) => (
                  <a key={f.documentId} href={f.storageUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/20">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{f.fileName}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(f.fileSize)} · uploaded {new Date(f.uploadedAt).toLocaleDateString()}</span>
                    <Download className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </a>
                ))}
              </div>
            )}

            {resume?.state === "needs_processing" && (
              <div className="rounded-lg border border-dashed border-border p-4 text-center">
                <p className="text-sm text-muted-foreground">We started reading this file but haven't finished checking it for duplicates yet.</p>
                <Button size="sm" className="mt-2" onClick={() => handleContinueProcessing(activeSession.id)} disabled={loading}>
                  {loading ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Checking…</> : "Continue checking this file"}
                </Button>
              </div>
            )}

            {resume?.state === "empty" && (
              <p className="text-sm text-muted-foreground">Nothing was recognized from this upload yet.</p>
            )}

            {(resume?.state === "needs_review" || resume?.state === "partially_done") && decisionRecords.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Needs your decision</p>
                {decisionRecords.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-heading">
                        {String(r.normalizedPayload?.firstName ?? r.normalizedPayload?.businessName ?? r.sourceRowRef ?? "Record")}{" "}
                        {String(r.normalizedPayload?.lastName ?? "")}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <StatusBadge status={r.status} />
                        {r.validationErrors?.[0] && <span className="text-[11px] text-muted-foreground">{r.validationErrors[0]}</span>}
                      </div>
                    </div>
                    {r.status !== "needs_review" ? (
                      <div className="flex shrink-0 gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleDecision(activeSession.id, r.id, "reject")} disabled={loading}>Skip</Button>
                        <Button size="sm" onClick={() => handleDecision(activeSession.id, r.id, "approve")} disabled={loading}>Import anyway</Button>
                      </div>
                    ) : (
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                    )}
                  </div>
                ))}
              </div>
            )}

            {pendingCommitCount > 0 && (resume?.state === "ready_to_commit" || resume?.state === "partially_done" || resume?.state === "needs_review") && (
              <div className="flex items-center justify-between rounded-lg border border-dashed border-border p-3">
                <p className="text-xs text-muted-foreground">
                  Historical records import quietly — no invite emails, no automated messages, no "new lead" alerts. They'll simply appear in Hello to Cheers.
                </p>
                <Button size="sm" className="shrink-0" onClick={() => handleCommit(activeSession.id)} disabled={loading || pendingCommitCount === 0}>
                  {loading ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Importing…</> : <><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Import {pendingCommitCount} record{pendingCommitCount === 1 ? "" : "s"}</>}
                </Button>
              </div>
            )}

            {resume?.state === "done" && (
              <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-foreground">
                Everything from this file has been resolved — {outcomeSentence(resume.summary)}.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">History</CardTitle>
          <CardDescription>Every migration you've started, with what happened — leave and come back any time.</CardDescription>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No migrations started yet.</p>
          ) : (
            <div className="space-y-1.5">
              {sessions.map((s) => {
                const profile = sourceProfiles.find((p) => p.key === s.sourceKey);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => openSession(s.id)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted/20 ${s.id === activeSessionId ? "border-primary" : "border-border"}`}
                  >
                    <span>
                      <span className="font-medium text-heading">{profile?.displayName ?? s.sourceKey}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleDateString()}</span>
                    </span>
                    <SessionListBadge session={s} />
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusPill({ state, session }: { state: SessionResumeState; session: MigrationSession }) {
  const { label, tone } = humanStatus(state, session);
  return <Badge variant={tone}>{label}</Badge>;
}

/**
 * The history list can't afford a resume-state fetch per row up front (N
 * sessions -> N calls) — it renders directly from the already-loaded
 * MigrationSession.status, mapped to the same plain-language vocabulary
 * humanStatus() uses for the open session, just without the extra
 * "ready to commit vs. needs review" nuance that requires per-record
 * counts. Opening a session (openSession) always fetches the precise
 * resume state for the detail view above.
 */
function SessionListBadge({ session }: { session: MigrationSession }) {
  const map: Record<MigrationSession["status"], { label: string; tone: "success" | "warning" | "destructive" | "outline" }> = {
    uploaded: { label: "Uploaded — not yet reviewed", tone: "outline" },
    recognizing: { label: "Processing…", tone: "outline" },
    mapping: { label: "Processing…", tone: "outline" },
    validating: { label: "Processing…", tone: "outline" },
    ready_for_review: { label: "Needs your attention", tone: "warning" },
    committing: { label: "Importing…", tone: "outline" },
    committed: { label: "Complete", tone: "success" },
    partially_committed: { label: "Partly imported", tone: "warning" },
    failed: { label: "Something went wrong", tone: "destructive" },
    abandoned: { label: "Stopped", tone: "outline" },
  };
  const m = map[session.status] ?? { label: session.status, tone: "outline" as const };
  return <Badge variant={m.tone}>{m.label}</Badge>;
}
