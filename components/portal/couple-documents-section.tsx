"use client";

import { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ── Types ─────────────────────────────────────────────────────────────────────

type DocType =
  | "contract" | "invoice" | "upload" | "planning_guide"
  | "brochure" | "receipt" | "package" | "insurance" | "floor_plan" | "menu" | "permit" | "other";

type LineItem = { id: string; description: string; quantity: number; unitPrice: number; amount: number; type: string };

type CoupleDocument = {
  id: string;
  docType: DocType;
  name: string;
  status: string | null;
  signedAt: string | null;
  amount: number | null;
  balanceDue?: number | null;
  fileUrl: string | null;
  fileSize: number | null;
  mimeType: string | null;
  content?: string | null;
  signToken?: string | null;
  lineItems?: LineItem[];
  uploadedBy: "couple" | "venue" | "vendor";
  vendorName?: string | null;
  shareWithVenue?: boolean;
  createdAt: string;
};

type PaidLineItem = { id: string; label: string; amount: number; paidAt: string; paidAmount: number | null; paymentMethod: string | null; scheduleTitle: string };

type QuestionnaireSummary = { status: string };

// ── Constants ─────────────────────────────────────────────────────────────────

const DOC_META: Record<DocType, { emoji: string; label: string; color: string }> = {
  contract:       { emoji: "📝", label: "Contract",       color: "bg-blue-50 text-blue-700 border-blue-100" },
  invoice:        { emoji: "🧾", label: "Invoice",        color: "bg-amber-50 text-amber-700 border-amber-100" },
  upload:         { emoji: "📎", label: "Document",       color: "bg-gray-50 text-gray-600 border-gray-100" },
  planning_guide: { emoji: "📋", label: "Planning Guide", color: "bg-purple-50 text-purple-700 border-purple-100" },
  brochure:       { emoji: "📄", label: "Brochure",       color: "bg-gray-50 text-gray-600 border-gray-100" },
  receipt:        { emoji: "🧾", label: "Receipt",        color: "bg-green-50 text-green-700 border-green-100" },
  package:        { emoji: "📦", label: "Package",        color: "bg-indigo-50 text-indigo-700 border-indigo-100" },
  insurance:      { emoji: "🛡️", label: "Insurance",      color: "bg-sky-50 text-sky-700 border-sky-100" },
  floor_plan:     { emoji: "🗺️", label: "Floor Plan",     color: "bg-teal-50 text-teal-700 border-teal-100" },
  menu:           { emoji: "🍽️", label: "Menu",           color: "bg-orange-50 text-orange-700 border-orange-100" },
  permit:         { emoji: "📜", label: "Permit",         color: "bg-gray-50 text-gray-600 border-gray-100" },
  other:          { emoji: "📁", label: "File",           color: "bg-gray-50 text-gray-600 border-gray-100" },
};

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  signed:    { label: "Signed",    color: "bg-green-50 text-green-700 border-green-200" },
  sent:      { label: "Awaiting your signature", color: "bg-amber-50 text-amber-700 border-amber-200" },
  draft:     { label: "Draft",     color: "bg-gray-50 text-gray-500 border-gray-200" },
  paid:      { label: "Paid",      color: "bg-green-50 text-green-700 border-green-200" },
  overdue:   { label: "Overdue",   color: "bg-red-50 text-red-600 border-red-200" },
  cancelled: { label: "Void",      color: "bg-gray-50 text-gray-400 border-gray-200" },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
}

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Contract card — real content, read inline, sign if pending ────────────────

function ContractCard({ doc }: { doc: CoupleDocument }) {
  const [expanded, setExpanded] = useState(false);
  const needsSignature = doc.status === "sent" && !!doc.signToken;

  return (
    <div className={`w-full rounded-xl border overflow-hidden ${needsSignature ? "border-amber-300 bg-amber-50/30" : "border-border/60 bg-card"}`}>
      <div className="flex items-center gap-3 px-3 py-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg border bg-blue-50 text-blue-700 border-blue-100 shrink-0">📝</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-heading truncate">{doc.name}</span>
            {doc.status && STATUS_BADGE[doc.status] && (
              <Badge className={`text-[10px] px-1.5 py-0 border ${STATUS_BADGE[doc.status].color}`}>{STATUS_BADGE[doc.status].label}</Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
            {doc.signedAt ? <span>Signed {fmtDate(doc.signedAt)}</span> : <span>Sent {fmtDate(doc.createdAt)}</span>}
          </div>
        </div>
        <button type="button" onClick={() => setExpanded((v) => !v)}
          className="text-xs text-[var(--venue-primary)] hover:underline shrink-0">
          {expanded ? "Hide" : "Review"}
        </button>
      </div>
      {expanded && doc.content && (
        <div className="px-3 pb-3 border-t border-border/40 pt-3">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">{doc.content}</p>
        </div>
      )}
      {needsSignature && (
        <div className="px-3 pb-3">
          <a href={`/sign/${doc.signToken}`} target="_blank" rel="noopener noreferrer">
            <Button size="sm" className="text-xs">Review &amp; sign →</Button>
          </a>
        </div>
      )}
    </div>
  );
}

// ── Invoice card — real line items + balance due ───────────────────────────────

function InvoiceCard({ doc }: { doc: CoupleDocument }) {
  const [expanded, setExpanded] = useState(false);
  const hasBalance = (doc.balanceDue ?? 0) > 0;

  return (
    <div className={`w-full rounded-xl border overflow-hidden ${hasBalance ? "border-amber-300 bg-amber-50/30" : "border-border/60 bg-card"}`}>
      <div className="flex items-center gap-3 px-3 py-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg border bg-amber-50 text-amber-700 border-amber-100 shrink-0">🧾</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-heading truncate">{doc.name}</span>
            {doc.status && STATUS_BADGE[doc.status] && (
              <Badge className={`text-[10px] px-1.5 py-0 border ${STATUS_BADGE[doc.status].color}`}>{STATUS_BADGE[doc.status].label}</Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
            <span>Total {fmtCurrency(doc.amount ?? 0)}</span>
            {hasBalance && <span className="text-amber-700 font-medium">· {fmtCurrency(doc.balanceDue!)} due</span>}
          </div>
        </div>
        <button type="button" onClick={() => setExpanded((v) => !v)} className="text-xs text-[var(--venue-primary)] hover:underline shrink-0">
          {expanded ? "Hide" : "Details"}
        </button>
      </div>
      {expanded && doc.lineItems && (
        <div className="px-3 pb-3 border-t border-border/40 pt-3 space-y-1.5">
          {doc.lineItems.map((li) => (
            <div key={li.id} className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{li.description} {li.quantity !== 1 && <span className="opacity-70">× {li.quantity}</span>}</span>
              <span className="font-mono">{fmtCurrency(li.amount)}</span>
            </div>
          ))}
        </div>
      )}
      {hasBalance && (
        <div className="px-3 pb-3">
          <a href="#payments">
            <Button size="sm" variant="outline" className="text-xs">Go to Payments →</Button>
          </a>
        </div>
      )}
    </div>
  );
}

// ── Generic document / receipt row ──────────────────────────────────────────

function DocRow({ doc }: { doc: CoupleDocument }) {
  const meta = DOC_META[doc.docType] ?? DOC_META.other;
  const fromVendor =
    doc.uploadedBy === "vendor"
      ? (doc.vendorName?.trim() ? `From ${doc.vendorName.trim()}` : "From your vendors")
      : null;

  return (
    <div className="flex w-full items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-3 group">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg border ${meta.color}`}>{meta.emoji}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-heading truncate">{doc.name}</span>
          {doc.uploadedBy === "couple" && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground border-border">Your upload</Badge>
          )}
          {fromVendor && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground border-border">{fromVendor}</Badge>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
          <span>{meta.label}</span>
          {doc.amount != null && <span>· {fmtCurrency(doc.amount)}</span>}
          {doc.fileSize && <span>· {fmtBytes(doc.fileSize)}</span>}
          <span>· {fmtDate(doc.createdAt)}</span>
        </div>
      </div>
      {doc.fileUrl && (
        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
          className="shrink-0 text-xs font-semibold text-[var(--venue-primary)] hover:opacity-80 transition-opacity">
          Open ↗
        </a>
      )}
    </div>
  );
}

function ReceiptRow({ r }: { r: PaidLineItem }) {
  return (
    <div className="flex w-full items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-3">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg border bg-green-50 text-green-700 border-green-100 shrink-0">🧾</div>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-heading">{r.label}</span>
        <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
          <span>{fmtCurrency(r.paidAmount ?? r.amount)} paid</span>
          <span>· {fmtDate(r.paidAt)}</span>
          {r.paymentMethod && <span>· {r.paymentMethod}</span>}
        </div>
      </div>
    </div>
  );
}

// ── Questionnaire card — Program 4, Initiative C, Phase 6 (2026-07-23):
// a questionnaire is a document as much as it's a task; the couple should
// never wonder where it lives. Reuses the existing questionnaire status,
// links back to the same section Tasks already navigates to.
const QUESTIONNAIRE_STATUS_BADGE: Record<string, { label: string; color: string }> = {
  not_started: { label: "Not started", color: "bg-amber-50 text-amber-700 border-amber-200" },
  in_progress: { label: "In progress", color: "bg-amber-50 text-amber-700 border-amber-200" },
  submitted:   { label: "Submitted",   color: "bg-green-50 text-green-700 border-green-200" },
  completed:   { label: "Submitted",   color: "bg-green-50 text-green-700 border-green-200" },
};

function QuestionnaireCard({ status, onNavigate }: { status: string; onNavigate: (s: "questionnaire") => void }) {
  const badge = QUESTIONNAIRE_STATUS_BADGE[status] ?? QUESTIONNAIRE_STATUS_BADGE.not_started;
  const isDone = status === "submitted" || status === "completed";

  return (
    <button type="button" onClick={() => onNavigate("questionnaire")}
      className={`w-full text-left flex items-center gap-3 rounded-xl border px-3 py-3 transition-opacity hover:opacity-90 ${isDone ? "border-border/60 bg-card" : "border-amber-300 bg-amber-50/30"}`}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg border bg-purple-50 text-purple-700 border-purple-100 shrink-0">📋</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-heading">Final Details Questionnaire</span>
          <Badge className={`text-[10px] px-1.5 py-0 border ${badge.color}`}>{badge.label}</Badge>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">Meal selections, music, emergency contact, and more.</p>
      </div>
      <span className="text-xs font-semibold text-[var(--venue-primary)] shrink-0">{isDone ? "Review →" : "Complete →"}</span>
    </button>
  );
}

// ── Upload button ─────────────────────────────────────────────────────────────

function UploadRow({ token, onDone }: { token: string; onDone: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [shareWithVenue, setShareWithVenue] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("token", token);
      formData.append("category", "document");
      formData.append("visibility", shareWithVenue ? "venue" : "private");

      const res = await fetch("/api/portal/upload", { method: "POST", body: formData });
      const json = await res.json();
      if (json.url) {
        await fetch("/api/portal/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            name: file.name.replace(/\.[^.]+$/, ""),
            fileUrl: json.url,
            fileSize: file.size,
            mimeType: file.type,
            shareWithVenue,
            sourceType: "upload",
          }),
        });
        onDone();
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer hover:text-gray-700">
        <input type="checkbox" checked={shareWithVenue} onChange={(e) => setShareWithVenue(e.target.checked)} className="rounded" />
        Share with venue
      </label>
      <input ref={fileRef} type="file" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
      <Button size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()} className="text-xs">
        {uploading ? "Uploading…" : "+ Upload document"}
      </Button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CoupleDocumentsSection({ token, onNavigate }: { token: string; onNavigate?: (s: "questionnaire") => void }) {
  const [documents, setDocuments] = useState<CoupleDocument[]>([]);
  const [receipts, setReceipts] = useState<PaidLineItem[]>([]);
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [docsRes, paymentsRes, questionnaireRes] = await Promise.all([
        fetch(`/api/portal/documents?token=${token}`),
        fetch(`/api/portal/payments?token=${token}`),
        fetch(`/api/portal/questionnaire?token=${token}`),
      ]);
      const [docsJson, paymentsJson, questionnaireJson] = await Promise.all([docsRes.json(), paymentsRes.json(), questionnaireRes.json()]);
      setDocuments(docsJson.documents ?? []);
      setQuestionnaire(questionnaireJson.questionnaire ? { status: questionnaireJson.questionnaire.status } : null);

      // Receipts are derived from paid payment line items — not a separate
      // entity (Client Collaboration Workspace, 2026-07-22): "the client
      // should never need to find these through emails," but Hello to
      // Cheers has no first-class Receipt record, so this reuses the same
      // payment data the Payments tab already reads.
      type Schedule = { title: string; lineItems: { id: string; label: string; amount: number; status: string; paidAt: string | null; paidAmount: number | null; paymentMethod: string | null }[] };
      const schedules = (paymentsJson.schedules ?? []) as Schedule[];
      const paid: PaidLineItem[] = schedules.flatMap((s) =>
        s.lineItems.filter((li) => li.status === "paid" && li.paidAt).map((li) => ({
          id: li.id, label: li.label, amount: li.amount, paidAt: li.paidAt!, paidAmount: li.paidAmount,
          paymentMethod: li.paymentMethod, scheduleTitle: s.title,
        })),
      );
      setReceipts(paid);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [token]);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400"><div className="animate-pulse">Loading documents…</div></div>;
  }

  const contracts = documents.filter((d) => d.docType === "contract");
  const invoices = documents.filter((d) => d.docType === "invoice");
  const venueShared = documents.filter((d) => d.uploadedBy === "venue" && d.docType !== "contract" && d.docType !== "invoice");
  const vendorShared = documents.filter((d) => d.uploadedBy === "vendor" && d.docType !== "contract" && d.docType !== "invoice");
  const coupleUploaded = documents.filter((d) => d.uploadedBy === "couple");

  const pendingSignature = contracts.filter((c) => c.status === "sent" && c.signToken);
  const isEmpty = documents.length === 0 && receipts.length === 0 && !questionnaire;

  return (
    <div className="w-full space-y-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-heading">Documents</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Contracts, invoices, receipts, and anything your venue or vendors share — all in one place.
          </p>
        </div>
        <UploadRow token={token} onDone={load} />
      </div>

      {isEmpty && (
        <div className="text-center py-16 border border-dashed border-border rounded-xl text-muted-foreground">
          <div className="text-4xl mb-3">📂</div>
          <p className="text-sm font-medium text-heading">No documents yet</p>
          <p className="text-xs mt-1">Contracts, invoices, and shared files from your venue or vendors will appear here automatically.</p>
        </div>
      )}

      {pendingSignature.length > 0 && (
        <div className="w-full rounded-xl border border-amber-300 bg-amber-50/40 px-3 py-3">
          <p className="text-sm font-semibold text-amber-800">
            ✍️ {pendingSignature.length} contract{pendingSignature.length === 1 ? "" : "s"} waiting for your signature
          </p>
        </div>
      )}

      {contracts.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-heading">Contracts</h3>
          <div className="space-y-2">{contracts.map((doc) => <ContractCard key={doc.id} doc={doc} />)}</div>
        </section>
      )}

      {questionnaire && onNavigate && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-heading">Questionnaire</h3>
          <QuestionnaireCard status={questionnaire.status} onNavigate={onNavigate} />
        </section>
      )}

      {invoices.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-heading">Invoices</h3>
          <div className="space-y-2">{invoices.map((doc) => <InvoiceCard key={doc.id} doc={doc} />)}</div>
        </section>
      )}

      {receipts.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-heading">Receipts</h3>
          <div className="space-y-2">{receipts.map((r) => <ReceiptRow key={r.id} r={r} />)}</div>
        </section>
      )}

      {venueShared.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-heading">From your venue</h3>
          <div className="space-y-2">{venueShared.map((doc) => <DocRow key={doc.id} doc={doc} />)}</div>
        </section>
      )}

      {vendorShared.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-heading">From your vendors</h3>
          <div className="space-y-2">{vendorShared.map((doc) => <DocRow key={doc.id} doc={doc} />)}</div>
        </section>
      )}

      {coupleUploaded.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-heading">Your uploads</h3>
          <div className="space-y-2">{coupleUploaded.map((doc) => <DocRow key={doc.id} doc={doc} />)}</div>
        </section>
      )}
    </div>
  );
}
