"use client";

import * as React from "react";
import { useTransition } from "react";
import Papa from "papaparse";
import { Upload, ChevronRight, ChevronLeft, Check, AlertCircle, FileText, Sparkles } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  ENTITY_FIELDS,
  type EntityType, type FieldMapping, type ImportResult,
} from "@/lib/import/types";
import {
  buildTemplateCsv, getSampleValue, validateRequiredFields, looksLikeHeaderRow, isSyntheticColumnHeaders,
  rowToClientInput, rowToLeadInput, rowToVendorInput, rowToInventoryInput, rowToPackageInput,
  loadSavedMapping, saveMapping,
} from "@/lib/import/utils";
import {
  importCouplesAction, importLeadsAction, importVendorsAction, importInventoryAction, importPackagesAction,
  parseImportFileAction, parseImportTextAction, proposeFieldMappingAction,
} from "@/app/(app)/settings/import/actions";
import {
  importCouplesForVenueAction, importLeadsForVenueAction, importVendorsForVenueAction,
  importInventoryForVenueAction, importPackagesForVenueAction,
} from "@/app/admin/onboarding/import-actions";

type CsvRow = Record<string, string>;

const ENTITY_META: Record<EntityType, { label: string; resultPath: string; description: string }> = {
  couples:   { label: "Clients",   resultPath: "/clients",          description: "Import existing bookings as clients with linked events." },
  leads:     { label: "Leads",     resultPath: "/leads",            description: "Import prospect inquiries into your leads pipeline." },
  vendors:   { label: "Vendors",   resultPath: "/vendors",          description: "Import your existing vendor contacts and relationships." },
  inventory: { label: "Inventory Templates", resultPath: "/library/inventory", description: "Import your tables, chairs, decor, and other physical inventory." },
  packages:  { label: "Package Templates",   resultPath: "/library/packages",  description: "Import your existing service packages and pricing." },
};

const NEXT_STEP: Record<EntityType, { cta: string; href: string; detail: string }> = {
  couples: {
    cta:    "Invite clients to the portal",
    href:   "/clients",
    detail: "Your first client in the portal is your biggest activation milestone — and they'll love having a planning home.",
  },
  leads: {
    cta:    "Follow up with your leads",
    href:   "/leads",
    detail: "Leads that receive a response within the hour convert at 2× the rate. Now is the best time.",
  },
  vendors: {
    cta:    "Connect vendors to events",
    href:   "/vendors",
    detail: "Assigned vendors can see their timeline, upload documents, and receive tasks through the Vendor Portal.",
  },
  inventory: {
    cta:    "Add photos and set shapes for Floor Plans",
    href:   "/library/inventory",
    detail: "A photo and the right shape make an item easy to recognize once it's placed on a Floor Plan.",
  },
  packages: {
    cta:    "Review your packages",
    href:   "/library/packages",
    detail: "Double-check pricing and descriptions, then packages are ready to add to invoices.",
  },
};

// ── Step 0: Entity selector ───────────────────────────────────────────────────

function StepEntitySelect({ onSelect }: { onSelect: (e: EntityType) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">What are you importing?</h2>
        <p className="text-sm text-muted-foreground mt-1">Choose the type of data in your CSV file.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {(["couples", "leads", "vendors", "inventory", "packages"] as EntityType[]).map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onSelect(e)}
            className="rounded-xl border border-border bg-card hover:border-primary hover:bg-accent transition-colors p-4 text-left space-y-1 group"
          >
            <p className="text-sm font-semibold text-foreground group-hover:text-primary">{ENTITY_META[e].label}</p>
            <p className="text-xs text-muted-foreground">{ENTITY_META[e].description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Step 1: Upload ────────────────────────────────────────────────────────────
// Five sources, one destination: headers + rows into the same map → preview
// → import flow. CSV/Excel parse to real columns deterministically. A pasted
// list that already looks columnar parses the same way. Word, PDF, and any
// pasted text that doesn't look columnar all hand off to Luv, which proposes
// structured rows for review — never saved until the coordinator confirms
// them in the steps that follow (Vendor Management — Next Iteration, 2026-07-10).

const ACCEPTED_EXTENSIONS = ".csv,.xlsx,.xls,.docx,.pdf";

function looksTabular(text: string): boolean {
  const lines = text.trim().split("\n").filter(Boolean);
  if (lines.length < 2) return false;
  const delimiterCount = (line: string) => Math.max((line.match(/\t/g) ?? []).length, (line.match(/,/g) ?? []).length);
  const first = delimiterCount(lines[0]);
  return first > 0 && lines.slice(1, 5).every((l) => delimiterCount(l) === first);
}

function StepUpload({
  entity,
  onParsed,
  onBack,
}: {
  entity: EntityType;
  onParsed: (headers: string[], rows: CsvRow[], filename: string, assisted: boolean) => void;
  onBack: () => void;
}) {
  const [dragging, setDragging] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [working, setWorking] = React.useState(false);
  const [pasteText, setPasteText] = React.useState("");
  const [showPaste, setShowPaste] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  function parseCsv(file: File) {
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete(result) {
        const headers = result.meta.fields ?? [];
        if (headers.length === 0) { setError("CSV has no column headers."); return; }
        if (result.data.length === 0) { setError("CSV has no data rows."); return; }
        onParsed(headers, result.data, file.name, false);
      },
      error(err) { setError(err.message); },
    });
  }

  async function parseViaServer(file: File) {
    setWorking(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await parseImportFileAction(formData, entity);
      if (!result.ok) { setError(result.message); return; }
      onParsed(result.headers, result.rows as CsvRow[], file.name, result.assisted);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read this file.");
    } finally {
      setWorking(false);
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    const file = files[0];
    const name = file.name.toLowerCase();
    if (name.endsWith(".csv")) parseCsv(file);
    else if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".docx") || name.endsWith(".pdf")) void parseViaServer(file);
    else setError("That file type isn't supported. Try .csv, .xlsx, .docx, .pdf, or paste your list below.");
  }

  async function handlePasteSubmit() {
    if (!pasteText.trim()) return;
    setError(null);
    if (looksTabular(pasteText)) {
      const result = Papa.parse<CsvRow>(pasteText.trim(), { header: true, skipEmptyLines: true });
      const headers = result.meta.fields ?? [];
      if (headers.length > 0 && result.data.length > 0) {
        onParsed(headers, result.data, "Pasted list", false);
        return;
      }
    }
    // Doesn't look like clean columns — hand off to Luv.
    setWorking(true);
    try {
      const result = await parseImportTextAction(pasteText, entity);
      if (!result.ok) { setError(result.message); return; }
      onParsed(result.headers, result.rows as CsvRow[], "Pasted list", result.assisted);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't process this text.");
    } finally {
      setWorking(false);
    }
  }

  function handleDownloadTemplate() {
    const csv = buildTemplateCsv(entity);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wevenu-${entity}-template.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Bring in what you already have</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Importing <span className="font-medium text-foreground">{ENTITY_META[entity].label}</span>. CSV, Excel, Word, PDF, or just paste a list — column names don&apos;t need to match ours, you&apos;ll map (or confirm) them on the next step.
        </p>
        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="mt-2 text-xs font-medium text-primary hover:underline"
        >
          Download a template CSV for {ENTITY_META[entity].label.toLowerCase()}
        </button>
      </div>

      <div
        className={`rounded-xl border-2 border-dashed transition-colors cursor-pointer py-12 flex flex-col items-center gap-3 ${
          dragging ? "border-primary bg-accent" : "border-border hover:border-muted-foreground"
        } ${working ? "pointer-events-none opacity-60" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
      >
        <Upload className="h-8 w-8 text-muted-foreground" />
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">{working ? "Reading your file…" : "Drop a file here or click to browse"}</p>
          <p className="text-xs text-muted-foreground mt-1">CSV, Excel (.xlsx), Word (.docx), or PDF</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      <div>
        <button type="button" onClick={() => setShowPaste((v) => !v)} className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
          {showPaste ? "Hide paste box" : "Or paste your list instead"}
        </button>
        {showPaste && (
          <div className="mt-2 space-y-2">
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={6}
              placeholder="Paste anything — a table copied from a spreadsheet, or a plain list like &quot;ABC Florals, Jane Smith, jane@abcflorals.com, 555-1234&quot;."
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <Button type="button" size="sm" onClick={handlePasteSubmit} disabled={!pasteText.trim() || working}>
              {working ? "Reading…" : "Use this list"}
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex justify-start">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>
      </div>
    </div>
  );
}

// ── Step 2: Map fields ────────────────────────────────────────────────────────

function StepMapFields({
  entity,
  headers,
  rows,
  mapping,
  onChange,
  onNext,
  onBack,
  hasHeaderRow,
  headerRowLikely,
  onToggleHeaderRow,
}: {
  entity: EntityType;
  headers: string[];
  rows: CsvRow[];
  mapping: FieldMapping;
  onChange: (m: FieldMapping) => void;
  onNext: () => void;
  onBack: () => void;
  hasHeaderRow: boolean;
  headerRowLikely: boolean;
  onToggleHeaderRow: (next: boolean) => void;
}) {
  const fields = ENTITY_FIELDS[entity];
  const requiredMapped = fields
    .filter((f) => f.required)
    .every((f) => mapping[f.key]);
  const [suggesting, startSuggest] = useTransition();

  // Real per-column sample values, shown directly in each option — this is
  // what actually lets someone match "Email" to the right column by
  // recognizing "jane@abcflorals.com" rather than guessing "Column 3" vs
  // "Column 4" and checking after the fact. Especially important with no
  // real header row, where the header text itself ("Column 3") carries no
  // information at all.
  const headerSamples = React.useMemo(
    () => Object.fromEntries(headers.map((h) => [h, getSampleValue(rows, h)])),
    [headers, rows],
  );

  const unmappedCount = fields.filter((f) => !mapping[f.key]).length;

  // Migration Center §2.1 item 4 (2026-07-22) — the existing lowercase-
  // similarity auto-match already ran when this file was parsed; this is
  // for whatever it couldn't confidently resolve (an unfamiliar
  // competitor-export header like "Bride/Groom" instead of "First Name").
  // A proposal only: it fills in *unmapped* fields, never overwrites a
  // field the coordinator (or the earlier auto-match) already set.
  function handleSuggest() {
    startSuggest(async () => {
      const result = await proposeFieldMappingAction(headers, entity);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      const next = { ...mapping };
      let filled = 0;
      for (const [key, header] of Object.entries(result.mapping)) {
        if (!next[key] && header) { next[key] = header; filled++; }
      }
      if (filled === 0) {
        toast.info("Luv didn't find any new matches beyond what's already mapped.");
        return;
      }
      onChange(next);
      toast.success(`Luv suggested ${filled} mapping${filled === 1 ? "" : "s"} — review before continuing.`);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Map your columns</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Match each Hello to Cheers field to a column in your CSV. Required fields are marked with *.
          </p>
        </div>
        {unmappedCount > 0 && (
          <Button type="button" variant="outline" size="sm" onClick={handleSuggest} disabled={suggesting} className="shrink-0">
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            {suggesting ? "Asking Luv…" : "Suggest with Luv"}
          </Button>
        )}
      </div>

      {!headerRowLikely && hasHeaderRow && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            The first row of your file looks like it might be a real record (something that looks like a phone number, email, or date), not column headers — importing as-is would silently skip it. If your file doesn&apos;t have a header row, turn off &quot;First row is headers&quot; below so nothing gets lost.
          </div>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={hasHeaderRow}
          onChange={(e) => onToggleHeaderRow(e.target.checked)}
          className="rounded"
        />
        First row of my file is column headers
      </label>

      <div className="rounded-xl border border-border divide-y divide-border">
        {fields.map((field) => {
          const selected = mapping[field.key] ?? "";
          const sample = selected ? getSampleValue(rows, selected) : "";
          return (
            <div key={field.key} className="flex items-center gap-3 px-4 py-3">
              <div className="w-44 shrink-0">
                <span className="text-sm text-foreground">{field.label}</span>
                {field.required && <span className="text-destructive ml-0.5">*</span>}
              </div>
              <select
                className="flex-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={selected}
                onChange={(e) => onChange({ ...mapping, [field.key]: e.target.value || null })}
              >
                <option value="">— skip this field —</option>
                {headers.map((h) => {
                  const preview = headerSamples[h];
                  return (
                    <option key={h} value={h}>
                      {preview ? `${h} — e.g. "${preview}"` : `${h} (empty)`}
                    </option>
                  );
                })}
              </select>
              {sample && (
                <span className="text-xs text-muted-foreground truncate max-w-[140px]" title={sample}>
                  e.g. {sample}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Button size="sm" onClick={onNext} disabled={!requiredMapped}>
          Preview <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// ── Step 3: Preview ───────────────────────────────────────────────────────────

function StepPreview({
  entity,
  rows,
  mapping,
  assisted,
  onImport,
  onBack,
  isPending,
}: {
  entity: EntityType;
  rows: CsvRow[];
  mapping: FieldMapping;
  assisted: boolean;
  onImport: () => void;
  onBack: () => void;
  isPending: boolean;
}) {
  const fields = ENTITY_FIELDS[entity];
  const preview = rows.slice(0, 5);
  const { readyCount, issueCount } = validateRequiredFields(fields, mapping, rows);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Preview</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {readyCount} of {rows.length} rows are ready to import
          {issueCount > 0 && <span className="text-destructive"> · {issueCount} have missing required fields (will be skipped)</span>}
        </p>
        {assisted && (
          <p className="text-xs text-primary mt-1.5 rounded-md bg-primary/5 px-2 py-1 inline-block">
            Luv helped structure this from your document — double-check each row before importing.
          </p>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {fields.filter((f) => mapping[f.key]).map((f) => (
                <th key={f.key} className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">
                  {f.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {preview.map((row, i) => {
              const missingRequired = fields
                .filter((f) => f.required)
                .some((f) => { const col = mapping[f.key]; return !col || !(row[col] ?? "").trim(); });
              return (
                <tr key={i} className={missingRequired ? "bg-destructive/5" : ""}>
                  {fields.filter((f) => mapping[f.key]).map((f) => (
                    <td key={f.key} className="px-3 py-2 text-foreground whitespace-nowrap max-w-[140px] truncate">
                      {(row[mapping[f.key]!] ?? "").trim() || (
                        f.required
                          ? <span className="text-destructive">missing</span>
                          : <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length > 5 && (
        <p className="text-xs text-muted-foreground">Showing first 5 of {rows.length} rows.</p>
      )}

      <div className="flex justify-between">
        <Button variant="ghost" size="sm" onClick={onBack} disabled={isPending}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Button size="sm" onClick={onImport} disabled={isPending || readyCount === 0}>
          {isPending ? "Importing…" : `Import ${readyCount} ${ENTITY_META[entity].label}`}
        </Button>
      </div>
    </div>
  );
}

// ── Step 4: Results ───────────────────────────────────────────────────────────

function downloadErrorsCsv(errors: ImportResult["errors"], filename: string) {
  const rows = [["Row", "Type", "Message"]];
  for (const e of errors) {
    rows.push([String(e.row), e.kind, e.message.replace(/"/g, '""')]);
  }
  const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `import-errors-${filename.replace(".csv", "")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function StepResults({
  entity,
  result,
  filename,
  onReset,
  venueId,
}: {
  entity: EntityType;
  result: ImportResult;
  filename: string;
  onReset: () => void;
  venueId?: string;
}) {
  const meta = ENTITY_META[entity];
  const skipped = result.errors.filter((e) => e.kind === "skipped").length;
  const errored = result.errors.filter((e) => e.kind === "error").length;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-success/10 p-2 mt-0.5">
          <Check className="h-4 w-4 text-success" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">Import complete</h2>
          <p className="text-sm text-muted-foreground mt-0.5">From {filename}</p>
        </div>
      </div>

      {/* Breakdown */}
      <div className="rounded-xl border border-border divide-y divide-border">
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="text-sm text-foreground">Imported</span>
          <span className="text-sm font-semibold text-success">{result.imported}</span>
        </div>
        {skipped > 0 && (
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-sm text-foreground">Skipped <span className="text-xs text-muted-foreground ml-1">missing fields or already active — see below</span></span>
            <span className="text-sm font-medium text-muted-foreground">{skipped}</span>
          </div>
        )}
        {errored > 0 && (
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-sm text-foreground">Errors</span>
            <span className="text-sm font-medium text-destructive">{errored}</span>
          </div>
        )}
      </div>

      {result.errors.length > 0 && (
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <AlertCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
              {result.errors.length} row{result.errors.length !== 1 ? "s" : ""} not imported
            </div>
            <button
              type="button"
              onClick={() => downloadErrorsCsv(result.errors, filename)}
              className="text-xs text-primary hover:underline"
            >
              Download CSV
            </button>
          </div>
          <ul className="space-y-1">
            {result.errors.slice(0, 8).map((e) => (
              <li key={e.row} className="text-xs text-muted-foreground">
                <span className="font-medium">Row {e.row}</span> — {e.message}
              </li>
            ))}
            {result.errors.length > 8 && (
              <li className="text-xs text-muted-foreground">…and {result.errors.length - 8} more (download CSV for full list)</li>
            )}
          </ul>
        </div>
      )}

      {/* The self-service "next step" CTA points at the venue's own app pages
          (/clients, /leads, …) — meaningless to an HQ admin's own session,
          which has no venue of its own. Suppressed in "Importing for
          {venue}" mode (venueId set); a link back to the onboarding
          workspace takes its place below instead. */}
      {result.imported > 0 && !venueId && (() => {
        const next = NEXT_STEP[entity];
        return (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Recommended Next Step</p>
            <p className="text-sm font-medium text-foreground">{next.cta}</p>
            <p className="text-xs text-muted-foreground">{next.detail}</p>
            <Link
              href={next.href}
              className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors mt-1"
            >
              {next.cta} →
            </Link>
          </div>
        );
      })()}

      <div className="flex flex-wrap gap-3">
        <Link
          href={venueId ? `/admin/onboarding/${venueId}` : meta.resultPath}
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          {venueId ? "Back to onboarding workspace →" : `View all ${meta.label.toLowerCase()} →`}
        </Link>
        <button type="button" onClick={onReset} className="text-sm text-muted-foreground hover:text-foreground hover:underline">
          Import more
        </button>
      </div>
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-colors ${i < step ? "bg-primary" : "bg-border"}`}
        />
      ))}
    </div>
  );
}

// ── Main wizard ───────────────────────────────────────────────────────────────

// A file with no real header row silently loses its first record — it
// gets consumed as "column headers" instead of imported. Derives the
// headers/rows a step actually sees from the raw as-parsed values (which
// always assume row 1 is headers) plus whether that assumption holds —
// pure and reversible, so toggling never loses or reshuffles data.
function deriveHeadersRows(rawHeaders: string[], rawRows: CsvRow[], hasHeaderRow: boolean): { headers: string[]; rows: CsvRow[] } {
  if (hasHeaderRow) return { headers: rawHeaders, rows: rawRows };
  const headers = rawHeaders.map((_, i) => `Column ${i + 1}`);
  const headerAsRow: CsvRow = {};
  rawHeaders.forEach((h, i) => { headerAsRow[headers[i]] = h; });
  const rows = [headerAsRow, ...rawRows.map((r) => {
    const nr: CsvRow = {};
    rawHeaders.forEach((h, i) => { nr[headers[i]] = r[h] ?? ""; });
    return nr;
  })];
  return { headers, rows };
}

/**
 * White-Glove Migration (Hospitality Success Platform §2.2a step 4) — the
 * optional `venueId` prop is what turns this into the "Importing for
 * {venue}" staff mode: same wizard, same steps, but every write is scoped
 * to the given venue via the admin actions rather than the caller's own
 * session (an HQ admin has no venue of their own).
 */
export function ImportWizard({ initialEntity, venueId }: { initialEntity?: EntityType; venueId?: string }) {
  const [step, setStep]         = React.useState<number>(initialEntity ? 1 : 0);
  const [entity, setEntity]     = React.useState<EntityType | null>(initialEntity ?? null);
  const [rawHeaders, setRawHeaders] = React.useState<string[]>([]);
  const [rawRows, setRawRows]       = React.useState<CsvRow[]>([]);
  const [hasHeaderRow, setHasHeaderRow] = React.useState(true);
  const [filename, setFilename] = React.useState("");
  const [mapping, setMapping]   = React.useState<FieldMapping>({});
  const [assisted, setAssisted] = React.useState(false);
  const [result, setResult]     = React.useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  const { headers, rows } = React.useMemo(
    () => deriveHeadersRows(rawHeaders, rawRows, hasHeaderRow),
    [rawHeaders, rawRows, hasHeaderRow],
  );

  function handleEntitySelect(e: EntityType) {
    setEntity(e);
    setStep(1);
  }

  // hasRealHeaders distinguishes a genuine header row from the "Column 1,
  // Column 2…" placeholders deriveHeadersRows falls back to when there
  // isn't one. Found live: reusing a saved mapping when headers are those
  // placeholders is actively dangerous, not just unhelpful — "Column 1..5"
  // from one header-less paste looks identical to "Column 1..5" from any
  // other header-less paste of a completely different list, so
  // loadSavedMapping's headers-match check would silently reapply a
  // stale mapping from an unrelated earlier import (wrong field assigned
  // to wrong data, with no error until the import itself fails).
  function guessMapping(h: string[], hasRealHeaders: boolean) {
    if (hasRealHeaders) {
      const saved = loadSavedMapping(entity!, h);
      if (saved) { setMapping(saved); return; }
    }
    // Auto-match by lowercase similarity — only meaningful with real
    // headers; against "Column N" placeholders nothing matches, which is
    // correct (every field starts unmapped rather than guessed wrong).
    const fields = ENTITY_FIELDS[entity!];
    const initial: FieldMapping = {};
    for (const field of fields) {
      const match = h.find(
        (col) =>
          col.toLowerCase().replace(/\s+/g, "") === field.label.toLowerCase().replace(/\s+/g, "") ||
          col.toLowerCase().replace(/\s+/g, "") === field.key.toLowerCase()
      );
      initial[field.key] = match ?? null;
    }
    setMapping(initial);
  }

  function handleParsed(h: string[], r: CsvRow[], name: string, wasAssisted: boolean) {
    // A real header never itself looks like a phone number, email, or
    // date — if row 1 does, it's very likely a data row, not headers.
    const headerRowLikely = looksLikeHeaderRow(h);
    setRawHeaders(h);
    setRawRows(r);
    setHasHeaderRow(headerRowLikely);
    setFilename(name);
    setAssisted(wasAssisted);
    const derivedHeaders = deriveHeadersRows(h, r, headerRowLikely).headers;
    guessMapping(derivedHeaders, headerRowLikely && !isSyntheticColumnHeaders(derivedHeaders));
    setStep(2);
  }

  function handleToggleHeaderRow(next: boolean) {
    setHasHeaderRow(next);
    const derivedHeaders = deriveHeadersRows(rawHeaders, rawRows, next).headers;
    guessMapping(derivedHeaders, next && !isSyntheticColumnHeaders(derivedHeaders));
  }

  function handleImport() {
    if (!entity) return;
    // Only worth remembering against real column names — saving a mapping
    // keyed on "Column 1, Column 2…" would just set up the exact same
    // stale-reuse trap for the next header-less import (whether those
    // placeholders came from a headerless CSV or from the paste-fallback
    // splitter in lib/luv/import-assist.ts).
    if (hasHeaderRow && !isSyntheticColumnHeaders(headers)) saveMapping(entity, headers, mapping);
    startTransition(async () => {
      let res: ImportResult;
      if (entity === "couples") {
        const inputRows = rows.map((r) => rowToClientInput(r, mapping));
        res = venueId ? await importCouplesForVenueAction(venueId, inputRows) : await importCouplesAction(inputRows);
      } else if (entity === "leads") {
        const inputRows = rows.map((r) => rowToLeadInput(r, mapping));
        res = venueId ? await importLeadsForVenueAction(venueId, inputRows) : await importLeadsAction(inputRows);
      } else if (entity === "vendors") {
        const inputRows = rows.map((r) => rowToVendorInput(r, mapping));
        res = venueId ? await importVendorsForVenueAction(venueId, inputRows) : await importVendorsAction(inputRows);
      } else if (entity === "inventory") {
        const inputRows = rows.map((r) => rowToInventoryInput(r, mapping));
        res = venueId ? await importInventoryForVenueAction(venueId, inputRows) : await importInventoryAction(inputRows);
      } else {
        const inputRows = rows.map((r) => rowToPackageInput(r, mapping));
        res = venueId ? await importPackagesForVenueAction(venueId, inputRows) : await importPackagesAction(inputRows);
      }
      setResult(res);
      setStep(4);
    });
  }

  function handleReset() {
    setStep(initialEntity ? 1 : 0);
    setEntity(initialEntity ?? null);
    setRawHeaders([]);
    setRawRows([]);
    setHasHeaderRow(true);
    setFilename("");
    setMapping({});
    setAssisted(false);
    setResult(null);
  }

  const totalSteps = 4; // 0 = entity select, 1-4 = upload/map/preview/results (entity select is outside progress)
  const showProgress = step > 0;

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      {showProgress && <ProgressBar step={step} total={totalSteps} />}

      {step === 0 && (
        <StepEntitySelect onSelect={handleEntitySelect} />
      )}

      {step === 1 && entity && (
        <StepUpload
          entity={entity}
          onParsed={handleParsed}
          onBack={() => { if (!initialEntity) setStep(0); }}
        />
      )}

      {step === 2 && entity && (
        <StepMapFields
          entity={entity}
          headers={headers}
          rows={rows}
          mapping={mapping}
          onChange={setMapping}
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
          hasHeaderRow={hasHeaderRow}
          headerRowLikely={looksLikeHeaderRow(rawHeaders)}
          onToggleHeaderRow={handleToggleHeaderRow}
        />
      )}

      {step === 3 && entity && (
        <StepPreview
          entity={entity}
          rows={rows}
          mapping={mapping}
          assisted={assisted}
          onImport={handleImport}
          onBack={() => setStep(2)}
          isPending={pending}
        />
      )}

      {step === 4 && entity && result && (
        <StepResults
          entity={entity}
          result={result}
          filename={filename}
          onReset={handleReset}
          venueId={venueId}
        />
      )}
    </div>
  );
}
