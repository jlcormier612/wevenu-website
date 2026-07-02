"use client";

import { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ── Types ─────────────────────────────────────────────────────────────────────

type DocType =
  | "contract" | "invoice" | "upload" | "planning_guide"
  | "brochure" | "receipt" | "package" | "other";

type CoupleDocument = {
  id: string;
  docType: DocType;
  name: string;
  status: string | null;
  signedAt: string | null;
  amount: number | null;
  fileUrl: string | null;
  fileSize: number | null;
  mimeType: string | null;
  uploadedBy: "couple" | "venue";
  shareWithVenue?: boolean;
  createdAt: string;
};

type VenueInfo = {
  parkingInfo: string | null;
  transportation: string | null;
  hotelBlocks: Array<{ name: string; url?: string; code?: string; notes?: string }>;
  nearbyAccommodations: string | null;
  thingsToDo: string | null;
  faqs: Array<{ question: string; answer: string }>;
  policies: string | null;
  ceremonyInstructions: string | null;
  rainPlan: string | null;
  importantContacts: Array<{ name: string; role?: string; phone?: string; email?: string }>;
} | null;

// ── Constants ─────────────────────────────────────────────────────────────────

const DOC_META: Record<DocType, { emoji: string; label: string; color: string }> = {
  contract:      { emoji: "📝", label: "Contract",       color: "bg-blue-50 text-blue-700 border-blue-100" },
  invoice:       { emoji: "🧾", label: "Invoice",        color: "bg-amber-50 text-amber-700 border-amber-100" },
  upload:        { emoji: "📎", label: "Document",       color: "bg-gray-50 text-gray-600 border-gray-100" },
  planning_guide:{ emoji: "📋", label: "Planning Guide", color: "bg-purple-50 text-purple-700 border-purple-100" },
  brochure:      { emoji: "📄", label: "Brochure",       color: "bg-gray-50 text-gray-600 border-gray-100" },
  receipt:       { emoji: "🧾", label: "Receipt",        color: "bg-green-50 text-green-700 border-green-100" },
  package:       { emoji: "📦", label: "Package",        color: "bg-indigo-50 text-indigo-700 border-indigo-100" },
  other:         { emoji: "📁", label: "File",           color: "bg-gray-50 text-gray-600 border-gray-100" },
};

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  signed:    { label: "Signed",   color: "bg-green-50 text-green-700 border-green-200" },
  pending:   { label: "Pending",  color: "bg-amber-50 text-amber-700 border-amber-200" },
  draft:     { label: "Draft",    color: "bg-gray-50 text-gray-500 border-gray-200" },
  paid:      { label: "Paid",     color: "bg-green-50 text-green-700 border-green-200" },
  unpaid:    { label: "Unpaid",   color: "bg-red-50 text-red-600 border-red-200" },
  partial:   { label: "Partial",  color: "bg-amber-50 text-amber-700 border-amber-200" },
  overdue:   { label: "Overdue",  color: "bg-red-50 text-red-600 border-red-200" },
  cancelled: { label: "Void",     color: "bg-gray-50 text-gray-400 border-gray-200" },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Document row ──────────────────────────────────────────────────────────────

function DocRow({ doc }: { doc: CoupleDocument }) {
  const meta = DOC_META[doc.docType] ?? DOC_META.other;
  const statusMeta = doc.status ? STATUS_BADGE[doc.status] : null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/60 transition-colors group rounded-lg">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg border ${meta.color}`}>
        {meta.emoji}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-[#2D3D2D] truncate">{doc.name}</span>
          {statusMeta && (
            <Badge className={`text-[10px] px-1.5 py-0 border ${statusMeta.color}`}>
              {statusMeta.label}
            </Badge>
          )}
          {doc.uploadedBy === "couple" && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-gray-400 border-gray-200">
              Your upload
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-[11px] text-gray-400">
          <span>{meta.label}</span>
          {doc.amount != null && <span>· {fmtCurrency(doc.amount)}</span>}
          {doc.signedAt && <span>· Signed {fmtDate(doc.signedAt)}</span>}
          {doc.fileSize && <span>· {fmtBytes(doc.fileSize)}</span>}
          <span>· {fmtDate(doc.createdAt)}</span>
        </div>
      </div>

      {doc.fileUrl ? (
        <a
          href={doc.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="opacity-0 group-hover:opacity-100 text-xs text-[#5D6F5D] hover:text-[#3D5040] transition-opacity px-2 py-1 rounded border border-transparent hover:border-[#5D6F5D]/20"
        >
          Open ↗
        </a>
      ) : (
        <span className="opacity-0 group-hover:opacity-100 text-[11px] text-gray-300">
          Online record
        </span>
      )}
    </div>
  );
}

// ── Venue Info Section ────────────────────────────────────────────────────────

function InfoBlock({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="mb-4">
      <h4 className="text-xs font-semibold text-[#5D6F5D] uppercase tracking-wide mb-1">{label}</h4>
      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{value}</p>
    </div>
  );
}

function VenueInfoSection({ info }: { info: VenueInfo }) {
  const [open, setOpen] = useState(false);

  if (!info) {
    return (
      <div className="mt-8 px-4 py-6 border border-dashed border-gray-200 rounded-xl text-center text-gray-400">
        <div className="text-2xl mb-2">🏛</div>
        <p className="text-sm">Your venue hasn't added operational details yet.</p>
        <p className="text-xs mt-1">Check back closer to your event for parking, hotel recommendations, and FAQs.</p>
      </div>
    );
  }

  const hasContent = info.parkingInfo || info.transportation || info.hotelBlocks.length ||
    info.nearbyAccommodations || info.thingsToDo || info.faqs.length ||
    info.policies || info.ceremonyInstructions || info.rainPlan || info.importantContacts.length;

  if (!hasContent) return null;

  return (
    <div className="mt-6 border border-[#e0e8e0] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[#f5f8f5] hover:bg-[#edf2ed] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">🏛</span>
          <span className="text-sm font-semibold text-[#2D3D2D]">Venue Information</span>
        </div>
        <span className="text-gray-400 text-sm">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-5 py-4 bg-white">
          <InfoBlock label="Parking" value={info.parkingInfo} />
          <InfoBlock label="Transportation" value={info.transportation} />

          {info.hotelBlocks.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-[#5D6F5D] uppercase tracking-wide mb-2">Hotel Blocks</h4>
              <div className="space-y-2">
                {info.hotelBlocks.map((h, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-3">
                    <div className="text-sm font-medium text-[#2D3D2D]">{h.name}</div>
                    {h.code && <div className="text-xs text-gray-500">Code: <span className="font-mono font-semibold">{h.code}</span></div>}
                    {h.notes && <div className="text-xs text-gray-500 mt-0.5">{h.notes}</div>}
                    {h.url && (
                      <a href={h.url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-[#5D6F5D] hover:underline mt-1 inline-block">
                        Book now ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <InfoBlock label="Nearby Accommodations" value={info.nearbyAccommodations} />
          <InfoBlock label="Things To Do" value={info.thingsToDo} />
          <InfoBlock label="Ceremony Instructions" value={info.ceremonyInstructions} />
          <InfoBlock label="Rain Plan" value={info.rainPlan} />
          <InfoBlock label="Policies" value={info.policies} />

          {info.faqs.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-[#5D6F5D] uppercase tracking-wide mb-2">FAQs</h4>
              <div className="space-y-3">
                {info.faqs.map((faq, i) => (
                  <div key={i}>
                    <p className="text-sm font-medium text-[#2D3D2D]">{faq.question}</p>
                    <p className="text-sm text-gray-600 mt-0.5">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {info.importantContacts.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-[#5D6F5D] uppercase tracking-wide mb-2">Important Contacts</h4>
              <div className="space-y-2">
                {info.importantContacts.map((c, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-[#eef4ee] flex items-center justify-center text-xs font-semibold text-[#5D6F5D] shrink-0">
                      {c.name[0]}
                    </div>
                    <div>
                      <div className="text-xs font-medium text-[#2D3D2D]">{c.name}</div>
                      {c.role && <div className="text-[11px] text-gray-400">{c.role}</div>}
                      {c.phone && <div className="text-[11px] text-gray-500">{c.phone}</div>}
                      {c.email && <div className="text-[11px] text-gray-500">{c.email}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
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
        // Save as a couple_document record
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
        <input
          type="checkbox"
          checked={shareWithVenue}
          onChange={e => setShareWithVenue(e.target.checked)}
          className="rounded"
        />
        Share with venue
      </label>
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      <Button
        size="sm"
        variant="outline"
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
        className="text-xs"
      >
        {uploading ? "Uploading…" : "+ Upload document"}
      </Button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CoupleDocumentsSection({ token }: { token: string }) {
  const [documents, setDocuments] = useState<CoupleDocument[]>([]);
  const [venueInfo, setVenueInfo] = useState<VenueInfo | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<DocType | "all">("all");

  const load = async () => {
    setLoading(true);
    try {
      const [docsRes, infoRes] = await Promise.all([
        fetch(`/api/portal/documents?token=${token}`),
        fetch(`/api/portal/venue-info?token=${token}`),
      ]);
      const [docsJson, infoJson] = await Promise.all([docsRes.json(), infoRes.json()]);
      setDocuments(docsJson.documents ?? []);
      setVenueInfo(infoJson);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [token]);

  const docTypes = Array.from(new Set(documents.map(d => d.docType)));
  const filtered = filterType === "all" ? documents : documents.filter(d => d.docType === filterType);

  const venueShared  = filtered.filter(d => d.uploadedBy === "venue");
  const coupleUploaded = filtered.filter(d => d.uploadedBy === "couple");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="animate-pulse">Loading documents…</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold text-[#2D3D2D]">Documents</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Everything your venue has shared, plus your own uploads — all in one place.
          </p>
        </div>
        <UploadRow token={token} onDone={load} />
      </div>

      {/* Filter tabs */}
      {docTypes.length > 1 && (
        <div className="flex gap-1.5 flex-wrap mb-4">
          <button
            onClick={() => setFilterType("all")}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              filterType === "all"
                ? "bg-[#3D5040] text-white border-[#3D5040]"
                : "bg-white text-gray-500 border-gray-200 hover:border-[#5D6F5D]/40"
            }`}
          >
            All ({documents.length})
          </button>
          {docTypes.map(type => {
            const meta = DOC_META[type] ?? DOC_META.other;
            const count = documents.filter(d => d.docType === type).length;
            return (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  filterType === type
                    ? "bg-[#3D5040] text-white border-[#3D5040]"
                    : "bg-white text-gray-500 border-gray-200 hover:border-[#5D6F5D]/40"
                }`}
              >
                {meta.emoji} {meta.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {documents.length === 0 && (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-xl text-gray-400">
          <div className="text-4xl mb-3">📂</div>
          <p className="text-sm font-medium">No documents yet</p>
          <p className="text-xs mt-1">
            Contracts, invoices, and planning guides from your venue will appear here automatically.
          </p>
        </div>
      )}

      {/* Venue-shared documents */}
      {venueShared.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">
            From Your Venue
          </h3>
          <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-50">
            {venueShared.map(doc => <DocRow key={doc.id} doc={doc} />)}
          </div>
        </div>
      )}

      {/* Couple uploads */}
      {coupleUploaded.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">
            Your Uploads
          </h3>
          <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-50">
            {coupleUploaded.map(doc => <DocRow key={doc.id} doc={doc} />)}
          </div>
        </div>
      )}

      {/* Venue info */}
      <VenueInfoSection info={venueInfo ?? null} />
    </div>
  );
}
