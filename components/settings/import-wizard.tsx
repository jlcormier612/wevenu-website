"use client";

import * as React from "react";
import { useTransition } from "react";
import Papa from "papaparse";
import { Upload, ChevronRight, ChevronLeft, Check, AlertCircle, FileText } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  COUPLE_FIELDS, LEAD_FIELDS, VENDOR_FIELDS, ENTITY_FIELDS,
  type EntityType, type FieldMapping, type ImportResult,
} from "@/lib/import/types";
import {
  getSampleValue, validateRequiredFields,
  rowToClientInput, rowToLeadInput, rowToVendorInput,
  loadSavedMapping, saveMapping,
} from "@/lib/import/utils";
import { importCouplesAction, importLeadsAction, importVendorsAction } from "@/app/(app)/settings/import/actions";

type CsvRow = Record<string, string>;

const ENTITY_META: Record<EntityType, { label: string; resultPath: string; description: string }> = {
  couples: { label: "Couples",  resultPath: "/clients",  description: "Import existing bookings as couples with linked events." },
  leads:   { label: "Leads",    resultPath: "/leads",    description: "Import prospect inquiries into your leads pipeline." },
  vendors: { label: "Vendors",  resultPath: "/vendors",  description: "Import your existing vendor contacts and relationships." },
};

const NEXT_STEP: Record<EntityType, { cta: string; href: string; detail: string }> = {
  couples: {
    cta:    "Invite couples to the portal",
    href:   "/clients",
    detail: "Your first couple in the portal is your biggest activation milestone — and they'll love having a planning home.",
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
        {(["couples", "leads", "vendors"] as EntityType[]).map((e) => (
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

function StepUpload({
  entity,
  onParsed,
  onBack,
}: {
  entity: EntityType;
  onParsed: (headers: string[], rows: CsvRow[], filename: string) => void;
  onBack: () => void;
}) {
  const [dragging, setDragging] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  function parseFile(file: File) {
    if (!file.name.endsWith(".csv")) {
      setError("Only CSV files are supported.");
      return;
    }
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete(result) {
        const headers = result.meta.fields ?? [];
        if (headers.length === 0) { setError("CSV has no column headers."); return; }
        if (result.data.length === 0) { setError("CSV has no data rows."); return; }
        onParsed(headers, result.data, file.name);
      },
      error(err) { setError(err.message); },
    });
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    parseFile(files[0]);
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Upload your CSV</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Importing <span className="font-medium text-foreground">{ENTITY_META[entity].label}</span>. Any CSV export works — column names don&apos;t need to match ours.
        </p>
      </div>

      <div
        className={`rounded-xl border-2 border-dashed transition-colors cursor-pointer py-12 flex flex-col items-center gap-3 ${
          dragging ? "border-primary bg-accent" : "border-border hover:border-muted-foreground"
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
      >
        <Upload className="h-8 w-8 text-muted-foreground" />
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">Drop your CSV here or click to browse</p>
          <p className="text-xs text-muted-foreground mt-1">Exports from HoneyBook, Aisle Planner, or any spreadsheet</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
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
}: {
  entity: EntityType;
  headers: string[];
  rows: CsvRow[];
  mapping: FieldMapping;
  onChange: (m: FieldMapping) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const fields = ENTITY_FIELDS[entity];
  const requiredMapped = fields
    .filter((f) => f.required)
    .every((f) => mapping[f.key]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Map your columns</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Match each Wevenu field to a column in your CSV. Required fields are marked with *.
        </p>
      </div>

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
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
              {sample && (
                <span className="text-xs text-muted-foreground truncate max-w-[100px]" title={sample}>
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
  onImport,
  onBack,
  isPending,
}: {
  entity: EntityType;
  rows: CsvRow[];
  mapping: FieldMapping;
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
}: {
  entity: EntityType;
  result: ImportResult;
  filename: string;
  onReset: () => void;
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
            <span className="text-sm text-foreground">Skipped <span className="text-xs text-muted-foreground ml-1">missing required fields</span></span>
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

      {result.imported > 0 && (() => {
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
          href={meta.resultPath}
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          View all {meta.label.toLowerCase()} →
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

export function ImportWizard({ initialEntity }: { initialEntity?: EntityType }) {
  const [step, setStep]         = React.useState<number>(initialEntity ? 1 : 0);
  const [entity, setEntity]     = React.useState<EntityType | null>(initialEntity ?? null);
  const [headers, setHeaders]   = React.useState<string[]>([]);
  const [rows, setRows]         = React.useState<CsvRow[]>([]);
  const [filename, setFilename] = React.useState("");
  const [mapping, setMapping]   = React.useState<FieldMapping>({});
  const [result, setResult]     = React.useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  function handleEntitySelect(e: EntityType) {
    setEntity(e);
    setStep(1);
  }

  function handleParsed(h: string[], r: CsvRow[], name: string) {
    setHeaders(h);
    setRows(r);
    setFilename(name);
    // Auto-populate saved mapping if headers match
    const saved = loadSavedMapping(entity!, h);
    if (saved) {
      setMapping(saved);
    } else {
      // Auto-match by lowercase similarity
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
    setStep(2);
  }

  function handleImport() {
    if (!entity) return;
    saveMapping(entity, headers, mapping);
    startTransition(async () => {
      let res: ImportResult;
      if (entity === "couples") {
        const inputRows = rows.map((r) => rowToClientInput(r, mapping));
        res = await importCouplesAction(inputRows);
      } else if (entity === "leads") {
        const inputRows = rows.map((r) => rowToLeadInput(r, mapping));
        res = await importLeadsAction(inputRows);
      } else {
        const inputRows = rows.map((r) => rowToVendorInput(r, mapping));
        res = await importVendorsAction(inputRows);
      }
      setResult(res);
      setStep(4);
    });
  }

  function handleReset() {
    setStep(initialEntity ? 1 : 0);
    setEntity(initialEntity ?? null);
    setHeaders([]);
    setRows([]);
    setFilename("");
    setMapping({});
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
        />
      )}

      {step === 3 && entity && (
        <StepPreview
          entity={entity}
          rows={rows}
          mapping={mapping}
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
        />
      )}
    </div>
  );
}
