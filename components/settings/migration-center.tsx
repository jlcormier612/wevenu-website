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
 * Progressive disclosure, five moments: where are you moving from → what
 * are you bringing over → upload and review → import safely (quietly) →
 * progress and history. Not a rigid numbered wizard — a session can be
 * left and picked back up from the history list at any point.
 */
import * as React from "react";
import Papa from "papaparse";
import { AlertTriangle, CheckCircle2, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  addMigrationRowsAction,
  commitMigrationSessionAction,
  getMigrationSessionRecordsAction,
  getMigrationSessionSummaryAction,
  listMigrationSessionsAction,
  reviewMigrationRecordAction,
  runMigrationDedupeAction,
  startMigrationSessionAction,
} from "@/app/(app)/settings/migration-actions";
import type {
  MigrationEntityType, MigrationRecord, MigrationSession, RecordStatus, SessionSummary, SourceKey, SourceProfile,
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

const NEEDS_DECISION: RecordStatus[] = ["duplicate_likely", "conflict", "needs_review"];

function StatusBadge({ status }: { status: RecordStatus }) {
  const map: Partial<Record<RecordStatus, { label: string; variant: "success" | "warning" | "destructive" | "outline" }>> = {
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

export function MigrationCenter({ sourceProfiles }: { sourceProfiles: SourceProfile[] }) {
  const [sessions, setSessions] = React.useState<MigrationSession[]>([]);
  const [activeSessionId, setActiveSessionId] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState<SessionSummary | null>(null);
  const [decisionRecords, setDecisionRecords] = React.useState<MigrationRecord[]>([]);
  const [loading, startLoading] = React.useTransition();

  const [sourceKey, setSourceKey] = React.useState<SourceKey>("generic_csv");
  const [entityType, setEntityType] = React.useState<MigrationEntityType>("client");
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [rows, setRows] = React.useState<CsvRow[]>([]);
  const [mapping, setMapping] = React.useState<Record<string, string>>({});
  const fileRef = React.useRef<HTMLInputElement>(null);

  const selectedProfile = sourceProfiles.find((p) => p.key === sourceKey) ?? sourceProfiles[0];

  const refreshSessions = React.useCallback(() => {
    startLoading(async () => setSessions(await listMigrationSessionsAction()));
  }, []);

  React.useEffect(() => { refreshSessions(); }, [refreshSessions]);

  const refreshActive = React.useCallback((sessionId: string) => {
    startLoading(async () => {
      const s = await getMigrationSessionSummaryAction(sessionId);
      setSummary(s);
      const needsDecision = (await Promise.all(NEEDS_DECISION.map((status) => getMigrationSessionRecordsAction(sessionId, status)))).flat();
      setDecisionRecords(needsDecision as MigrationRecord[]);
    });
  }, []);

  React.useEffect(() => { if (activeSessionId) refreshActive(activeSessionId); }, [activeSessionId, refreshActive]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse<CsvRow>(file, {
      header: true, skipEmptyLines: true,
      complete: (results) => {
        const hs = results.meta.fields ?? [];
        setHeaders(hs);
        setRows(results.data);
        // Best-effort auto-match: exact case-insensitive header match to a field label.
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

  async function handleStartAndUpload() {
    if (rows.length === 0) { toast.error("Choose a file first."); return; }
    startLoading(async () => {
      const started = await startMigrationSessionAction(sourceKey);
      if (!started.ok) { toast.error(started.message); return; }
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
      setRows([]); setHeaders([]); setMapping({});
      if (fileRef.current) fileRef.current.value = "";
      setActiveSessionId(started.session.id);
      refreshSessions();
    });
  }

  function handleDecision(sessionId: string, recordId: string, decision: "approve" | "reject") {
    startLoading(async () => {
      const result = await reviewMigrationRecordAction(sessionId, recordId, decision);
      if (result.ok) refreshActive(sessionId);
      else toast.error(result.message);
    });
  }

  function handleCommit(sessionId: string) {
    startLoading(async () => {
      const result = await commitMigrationSessionAction(sessionId);
      if (!result.ok) { toast.error(result.message); return; }
      toast.success(`Imported ${result.outcome.committed}, skipped ${result.outcome.skipped}${result.outcome.failed ? `, ${result.outcome.failed} need another look` : ""}.`);
      refreshActive(sessionId);
      refreshSessions();
    });
  }

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
            <p className="mt-1 text-[11px] text-muted-foreground">CSV export from {selectedProfile?.displayName ?? "your old system"}.</p>
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
                <Button size="sm" onClick={handleStartAndUpload} disabled={loading}>
                  {loading ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Working…</> : <><Upload className="mr-1.5 h-3.5 w-3.5" />Bring in {rows.length} row{rows.length === 1 ? "" : "s"}</>}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {activeSessionId && summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Review</CardTitle>
            <CardDescription>
              Historical records import quietly — no invite emails, no automated messages, no "new lead" alerts. They'll simply appear in Hello to Cheers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4 text-sm">
              <div><span className="font-semibold text-heading">{summary.counts.validated + summary.counts.approved}</span> ready to import</div>
              <div><span className="font-semibold text-heading">{summary.counts.duplicate_exact}</span> already in Hello to Cheers</div>
              <div><span className="font-semibold text-heading">{decisionRecords.length}</span> need your decision</div>
              <div><span className="font-semibold text-heading">{summary.counts.committed}</span> already imported</div>
            </div>

            {decisionRecords.length > 0 && (
              <div className="space-y-2">
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
                        <Button size="sm" variant="outline" onClick={() => handleDecision(activeSessionId, r.id, "reject")} disabled={loading}>Skip</Button>
                        <Button size="sm" onClick={() => handleDecision(activeSessionId, r.id, "approve")} disabled={loading}>Import anyway</Button>
                      </div>
                    ) : (
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={() => handleCommit(activeSessionId)} disabled={loading || summary.counts.validated + summary.counts.approved === 0}>
                {loading ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Importing…</> : <><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Import {summary.counts.validated + summary.counts.approved} record{summary.counts.validated + summary.counts.approved === 1 ? "" : "s"}</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">History</CardTitle>
          <CardDescription>Every migration you've started, with what happened.</CardDescription>
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
                    onClick={() => setActiveSessionId(s.id)}
                    className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-muted/20"
                  >
                    <span>
                      <span className="font-medium text-heading">{profile?.displayName ?? s.sourceKey}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleDateString()}</span>
                    </span>
                    <Badge variant={s.status === "committed" ? "success" : s.status === "failed" ? "destructive" : "outline"}>
                      {s.status.replace(/_/g, " ")}
                    </Badge>
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
