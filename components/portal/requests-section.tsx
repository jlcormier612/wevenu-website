"use client";

/**
 * RequestsPortalSection — the Wedding Workspace's Request Center
 * (Wedding Workspace – Request Experience, Phase 1).
 *
 * A dedicated, primary section — not nested inside Tasks, Documents, or
 * Messages — because a Request represents work waiting on the client
 * regardless of which feature created it (Planning today; Timeline,
 * Documents, Contracts, Floor Plans, Guest Management once each connects
 * through the same framework). This section is the entry point only; it
 * never duplicates the originating feature's own UI.
 */
import * as React from "react";

import { Loader2, Paperclip } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/integrations/supabase/client";
import type {
  PortalRequestDetail, PortalRequestSummary, RequestSourceFeature, RequestType,
} from "@/lib/requests/types";
import type { PortalSection } from "@/lib/portal/types";

const ROSE = "#D8A7AA";
const ROSE_DEEP = "#C17F84";
const SAGE = "#5D6F5D";

const TYPE_LABELS: Record<RequestType, string> = {
  document: "Document", approval: "Approval", information: "Information",
  selection: "Selection", upload: "Upload", confirmation: "Confirmation", task: "Task",
};

const SOURCE_LABELS: Record<RequestSourceFeature, string> = {
  planning: "Planning", timeline: "Timeline", documents: "Documents",
  contracts: "Contracts", floor_plans: "Floor Plans", guests: "Guest List", manual: "Venue",
};

// The one Wedding Workspace section each source feature's "Open Related
// Item" points back into — never a duplicate of that feature's own UI.
const SOURCE_SECTION: Partial<Record<RequestSourceFeature, PortalSection>> = {
  planning: "tasks",
  timeline: "timeline",
  documents: "documents",
  guests: "guests",
};

type Group = { key: string; label: string; requests: PortalRequestSummary[] };

function groupRequests(requests: PortalRequestSummary[]): Group[] {
  const actionRequired = requests.filter((r) => r.status === "sent" || r.status === "viewed");
  const inProgress = requests.filter((r) => r.status === "in_progress");
  const waitingForVenue = requests.filter((r) => r.status === "submitted" || r.status === "reviewed");
  const completed = requests.filter((r) => r.status === "completed" || r.status === "cancelled");
  return [
    { key: "action_required", label: "Action Required", requests: actionRequired },
    { key: "in_progress", label: "In Progress", requests: inProgress },
    { key: "waiting_for_venue", label: "Waiting for Venue", requests: waitingForVenue },
    { key: "completed", label: "Completed", requests: completed },
  ].filter((g) => g.requests.length > 0);
}

function formatDue(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function StatusPill({ status }: { status: string }) {
  const labels: Record<string, string> = {
    draft: "Draft", sent: "New", viewed: "New", in_progress: "In Progress",
    submitted: "Submitted", reviewed: "In Review", completed: "Completed", cancelled: "Cancelled",
  };
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: `${SAGE}15`, color: SAGE }}>
      {labels[status] ?? status}
    </span>
  );
}

function RequestDetailView({
  token, requestId, onBack, onNavigate,
}: { token: string; requestId: string; onBack: () => void; onNavigate: (s: PortalSection) => void }) {
  const [detail, setDetail] = React.useState<PortalRequestDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [responseText, setResponseText] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    fetch(`/api/portal/requests/${requestId}?token=${token}`)
      .then((r) => r.json())
      .then((d: { request?: PortalRequestDetail }) => setDetail(d.request ?? null))
      .finally(() => setLoading(false));
  }, [requestId, token]);

  // Loading starts true (initial state) — this component is remounted fresh
  // per selected request, so there's no stale-loading state to reset here.
  React.useEffect(() => {
    fetch(`/api/portal/requests/${requestId}?token=${token}`)
      .then((r) => r.json())
      .then((d: { request?: PortalRequestDetail }) => setDetail(d.request ?? null))
      .finally(() => setLoading(false));
  }, [requestId, token]);

  async function submit(text: string | null, fileUrl: string | null) {
    setSubmitting(true);
    const res = await fetch(`/api/portal/requests/${requestId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, responseText: text, responseFileUrl: fileUrl }),
    });
    const data = await res.json() as { ok: boolean; error?: string };
    setSubmitting(false);
    if (data.ok) { toast.success("Submitted."); load(); }
    else toast.error(data.error ?? "Could not submit.");
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "file";
      const path = `${requestId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("request-uploads").upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("request-uploads").getPublicUrl(path);
      await submit(null, publicUrl);
    } catch {
      toast.error("Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  if (loading) return <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" /></div>;
  if (!detail) return <p className="text-sm text-muted-foreground">Request not found.</p>;

  const actionable = ["sent", "viewed", "in_progress"].includes(detail.status) && detail.clientActionEnabled;
  const sourceSection = detail.sourceFeature ? SOURCE_SECTION[detail.sourceFeature] : undefined;

  return (
    <div className="space-y-5">
      <button type="button" onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground">← Back to Requests</button>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-heading text-lg text-heading">{detail.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{TYPE_LABELS[detail.requestType]}{detail.sourceFeature ? ` · From ${SOURCE_LABELS[detail.sourceFeature]}` : ""}</p>
          </div>
          <StatusPill status={detail.status} />
        </div>
        {detail.description && <p className="text-sm text-heading leading-relaxed">{detail.description}</p>}
        {detail.dueDate && <p className="text-xs text-muted-foreground">Due {formatDue(detail.dueDate)}</p>}
        {sourceSection && (
          <button type="button" onClick={() => onNavigate(sourceSection)}
            className="text-xs font-semibold" style={{ color: ROSE_DEEP }}>
            Open Related Item →
          </button>
        )}
      </div>

      {/* Action UI — one per request type, all funneling through the same submit */}
      {actionable ? (
        <div className="rounded-2xl border p-5 space-y-3" style={{ borderColor: `${ROSE}30`, background: "#FDF8F8" }}>
          {detail.requestType === "information" || detail.requestType === "selection" ? (
            <>
              <textarea value={responseText} onChange={(e) => setResponseText(e.target.value)}
                placeholder={detail.requestType === "selection" ? "Type your selection…" : "Your answer…"}
                rows={3} className="w-full rounded-xl border px-3.5 py-2.5 text-sm resize-none focus:outline-none bg-white/80"
                style={{ borderColor: `${ROSE}40` }} />
              <button type="button" disabled={submitting || !responseText.trim()} onClick={() => submit(responseText, null)}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" style={{ background: ROSE_DEEP }}>
                {submitting ? "Submitting…" : "Submit"}
              </button>
            </>
          ) : detail.requestType === "upload" ? (
            <label className="flex items-center gap-2 cursor-pointer rounded-xl border px-4 py-2.5 text-sm font-medium w-fit"
              style={{ borderColor: `${ROSE}40`, color: ROSE_DEEP }}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
              {uploading ? "Uploading…" : "Choose a file to upload"}
              <input type="file" className="sr-only" onChange={handleUpload} disabled={uploading} />
            </label>
          ) : detail.requestType === "approval" ? (
            <div className="flex gap-2">
              <button type="button" disabled={submitting} onClick={() => submit("approved", null)}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: SAGE }}>Approve</button>
              <button type="button" disabled={submitting} onClick={() => submit("rejected", null)}
                className="rounded-xl px-4 py-2 text-sm font-semibold border" style={{ borderColor: `${ROSE}40`, color: ROSE_DEEP }}>Reject</button>
            </div>
          ) : detail.requestType === "confirmation" ? (
            <button type="button" disabled={submitting} onClick={() => submit("confirmed", null)}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: ROSE_DEEP }}>
              {submitting ? "Confirming…" : "Confirm"}
            </button>
          ) : detail.requestType === "task" ? (
            <button type="button" disabled={submitting} onClick={() => submit("completed by client", null)}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: SAGE }}>
              {submitting ? "Marking complete…" : "Mark Complete"}
            </button>
          ) : detail.requestType === "document" ? (
            detail.responseFileUrl ? (
              <a href={detail.responseFileUrl} target="_blank" rel="noopener noreferrer"
                className="inline-block rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: ROSE_DEEP }}>
                Open Document
              </a>
            ) : (
              <p className="text-xs text-muted-foreground">No document is attached yet.</p>
            )
          ) : null}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-muted/20 p-4">
          <p className="text-sm text-heading">
            {detail.status === "completed" ? "This request is complete."
              : detail.status === "cancelled" ? "This request was cancelled."
              : "Submitted — waiting on your venue."}
          </p>
          {detail.responseText && <p className="text-xs text-muted-foreground mt-1">Your response: {detail.responseText}</p>}
        </div>
      )}

      {/* History */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">History</p>
        <div className="space-y-1.5">
          {detail.history.map((h) => (
            <div key={h.id} className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: SAGE }} />
              <span>{h.fromStatus ? `${h.fromStatus} → ${h.toStatus}` : `Created`}</span>
              <span className="ml-auto">{new Date(h.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Wedding Workspace Home summary (Requirement 6) — additive only, does not
 * touch any existing Overview card. Needing action / recently completed /
 * next due date, reusing the exact same list the Request Center itself
 * fetches (no second data source, no second grouping rule).
 */
export function RequestsSummaryCard({ token, onNavigate }: { token: string; onNavigate: (s: PortalSection) => void }) {
  const [requests, setRequests] = React.useState<PortalRequestSummary[] | null>(null);

  React.useEffect(() => {
    fetch(`/api/portal/requests?token=${token}`)
      .then((r) => r.json())
      .then((d: { requests?: PortalRequestSummary[] }) => setRequests(d.requests ?? []));
  }, [token]);

  if (requests === null || requests.length === 0) return null;

  const needingAction = requests.filter((r) => r.status === "sent" || r.status === "viewed" || r.status === "in_progress");
  const recentlyCompleted = requests.filter((r) => r.status === "completed").slice(0, 3);
  const upcoming = requests
    .filter((r) => r.dueDate && r.status !== "completed" && r.status !== "cancelled")
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))
    .slice(0, 3);

  if (needingAction.length === 0 && recentlyCompleted.length === 0 && upcoming.length === 0) return null;

  return (
    <button type="button" onClick={() => onNavigate("requests")}
      className="w-full text-left rounded-2xl border bg-card p-5 hover:shadow-sm transition-all"
      style={needingAction.length > 0 ? { borderColor: `${ROSE}45`, background: `${ROSE}05` } : { borderColor: "#E8E3DC" }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl">📨</span>
        {needingAction.length > 0 && (
          <span className="font-heading text-2xl font-bold text-heading">{needingAction.length}</span>
        )}
      </div>
      <p className="text-sm font-semibold text-heading leading-snug">
        {needingAction.length > 0 ? `${needingAction.length} request${needingAction.length === 1 ? "" : "s"} need${needingAction.length === 1 ? "s" : ""} your attention` : "You're all caught up"}
      </p>
      {upcoming[0]?.dueDate && (
        <p className="text-[11px] text-muted-foreground mt-1">Next due {formatDue(upcoming[0].dueDate)}</p>
      )}
      {needingAction.length === 0 && recentlyCompleted.length > 0 && (
        <p className="text-[11px] text-muted-foreground mt-1">{recentlyCompleted.length} recently completed</p>
      )}
    </button>
  );
}

export function RequestsPortalSection({ token, onNavigate }: { token: string; onNavigate: (s: PortalSection) => void }) {
  const [requests, setRequests] = React.useState<PortalRequestSummary[] | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch(`/api/portal/requests?token=${token}`)
      .then((r) => r.json())
      .then((d: { requests?: PortalRequestSummary[] }) => setRequests(d.requests ?? []));
  }, [token]);

  if (selectedId) {
    return (
      <RequestDetailView token={token} requestId={selectedId} onBack={() => setSelectedId(null)} onNavigate={onNavigate} />
    );
  }

  const groups = requests ? groupRequests(requests) : [];

  return (
    <div className="space-y-6">
      <div className="rounded-3xl p-6" style={{ background: `linear-gradient(135deg, ${ROSE}10 0%, #FAF8F5 100%)`, border: `1px solid ${ROSE}25` }}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-1.5" style={{ color: ROSE_DEEP }}>📨 Requests</p>
        <p className="font-heading text-xl text-heading leading-snug">Everything waiting on you</p>
        <p className="text-sm text-muted-foreground mt-1">
          Anything your venue needs from you — a document, a decision, a confirmation — shows up here, however it started.
        </p>
      </div>

      {requests === null ? (
        <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" /></div>
      ) : requests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-10 text-center">
          <p className="text-sm font-medium text-heading">Nothing waiting on you right now</p>
          <p className="text-xs text-muted-foreground mt-1">Requests from your venue will show up here.</p>
        </div>
      ) : (
        groups.map((group) => (
          <div key={group.key} className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-1">
              {group.label} ({group.requests.length})
            </p>
            <div className="rounded-2xl border border-border bg-card divide-y divide-border/50">
              {group.requests.map((r) => (
                <button key={r.id} type="button" onClick={() => setSelectedId(r.id)}
                  className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-heading truncate">{r.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {TYPE_LABELS[r.requestType]}{r.sourceFeature ? ` · ${SOURCE_LABELS[r.sourceFeature]}` : ""}
                      {r.dueDate ? ` · Due ${formatDue(r.dueDate)}` : ""}
                    </p>
                  </div>
                  <StatusPill status={r.status} />
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
