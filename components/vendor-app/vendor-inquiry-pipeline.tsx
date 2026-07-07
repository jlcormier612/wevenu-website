"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, X } from "lucide-react";
import { useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { INQUIRY_STATUSES, ACTIVE_INQUIRY_STATUSES, INQUIRY_STATUS_VARIANT } from "@/lib/vendors/constants";
import { createVendorInquiryAction } from "@/app/vendor/inquiries/actions";
import type { VendorInquiry, InquiryStatus } from "@/lib/vendors/types";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

type Filter = "all" | InquiryStatus;

export function VendorInquiryPipeline({
  inquiries,
  counts,
}: {
  inquiries: VendorInquiry[];
  counts:    Partial<Record<InquiryStatus, number>>;
}) {
  const [filter, setFilter] = React.useState<Filter>("all");
  const [showForm, setShowForm] = React.useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [form, setForm] = React.useState({
    contactName:  "",
    contactEmail: "",
    eventDate:    "",
    eventType:    "",
    notes:        "",
    venueId:      "",
    source:       "manual",
  });

  const total = inquiries.length;
  const filtered = filter === "all" ? inquiries : inquiries.filter((i) => i.status === filter);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createVendorInquiryAction(form);
      if (result.ok) {
        setShowForm(false);
        setForm({ contactName: "", contactEmail: "", eventDate: "", eventType: "", notes: "", venueId: "", source: "manual" });
      } else {
        setError("message" in result ? (result.message ?? "Error") : "Error creating inquiry");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Inquiries</h1>
          <p className="text-sm text-muted-foreground">{total} total</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New Inquiry
        </Button>
      </div>

      {/* New inquiry form */}
      {showForm && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm text-foreground">New Inquiry</h2>
            <button type="button" onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Contact Name</label>
                <input
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="Jane Smith"
                  value={form.contactName}
                  onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Email</label>
                <input
                  type="email"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="jane@example.com"
                  value={form.contactEmail}
                  onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Event Date</label>
                <input
                  type="date"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  value={form.eventDate}
                  onChange={(e) => setForm((f) => ({ ...f, eventDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Event Type</label>
                <input
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="Wedding, Corporate…"
                  value={form.eventType}
                  onChange={(e) => setForm((f) => ({ ...f, eventType: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Notes</label>
              <textarea
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring min-h-[72px] resize-none"
                placeholder="How they heard about you, special requests…"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Saving…" : "Save Inquiry"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors border ${
            filter === "all"
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
          }`}
        >
          All {total > 0 && <span className="ml-1">({total})</span>}
        </button>
        {INQUIRY_STATUSES.map((s) => {
          const n = counts[s.value] ?? 0;
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => setFilter(s.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors border ${
                filter === s.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
              }`}
            >
              {s.label} {n > 0 && <span className="ml-1">({n})</span>}
            </button>
          );
        })}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {filter === "all" ? "No inquiries yet." : `No ${filter.replace(/_/g, " ")} inquiries.`}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {filtered.map((inq) => (
            <Link
              key={inq.id}
              href={`/vendor/inquiries/${inq.id}`}
              className="flex items-start gap-4 px-4 py-3.5 hover:bg-muted/40 transition-colors"
            >
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-sm font-medium text-foreground">{inq.contactName ?? "Unknown contact"}</p>
                {inq.venueName && (
                  <p className="text-xs text-muted-foreground">{inq.venueName}</p>
                )}
                {inq.eventDate && (
                  <p className="text-xs text-muted-foreground">{formatDate(inq.eventDate)}{inq.eventType ? ` · ${inq.eventType}` : ""}</p>
                )}
              </div>
              <div className="shrink-0 flex flex-col items-end gap-1.5">
                <Badge variant={INQUIRY_STATUS_VARIANT[inq.status]} className="text-xs">
                  {INQUIRY_STATUSES.find((s) => s.value === inq.status)?.label ?? inq.status}
                </Badge>
                <span className="text-[10px] text-muted-foreground">{formatRelative(inq.updatedAt)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
