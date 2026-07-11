"use client";

/**
 * RequestManager — the venue's Request Dashboard (Wedding Workspace –
 * Request Experience, Phase 1). Started as an internal verification-only
 * page (Request Framework Foundation); this completes it into the real
 * venue-side Request experience: filters, assignment, due-date ordering,
 * and Origin (which feature created it, if any).
 */
import * as React from "react";

import { assignRequestAction, createRequestAction, updateRequestStatusAction } from "@/app/(app)/requests/actions";
import { clientDisplayName } from "@/lib/clients/constants";
import type { Client } from "@/lib/clients/types";
import { REQUEST_STATUSES, REQUEST_TYPES, REQUEST_TYPE_LABELS, STATUS_LABELS } from "@/lib/requests/constants";
import type { Request, RequestStatus, RequestType } from "@/lib/requests/types";
import type { StaffMember } from "@/lib/team/types";

const EMPTY_FORM = {
  clientId: "", title: "", description: "", requestType: "task" as RequestType, dueDate: "",
};
const SOURCE_LABELS: Record<string, string> = {
  planning: "Planning", timeline: "Timeline", documents: "Documents",
  contracts: "Contracts", floor_plans: "Floor Plans", guests: "Guest List", manual: "Manual",
};
const ALL = "__all__";

export function RequestManager({
  initialRequests, clients, teamMembers,
}: { initialRequests: Request[]; clients: Client[]; teamMembers: StaffMember[] }) {
  const [requests, setRequests] = React.useState(initialRequests);
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [creating, setCreating] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const [statusFilter, setStatusFilter] = React.useState(ALL);
  const [typeFilter, setTypeFilter] = React.useState(ALL);
  const [assigneeFilter, setAssigneeFilter] = React.useState(ALL);

  function clientName(clientId: string): string {
    const c = clients.find((x) => x.id === clientId);
    return c ? clientDisplayName(c.firstName, c.lastName, c.partnerFirstName, c.partnerLastName) : clientId;
  }

  function staffName(staffId: string | null): string {
    if (!staffId) return "Unassigned";
    return teamMembers.find((m) => m.id === staffId)?.name ?? staffId;
  }

  const filtered = requests.filter((r) =>
    (statusFilter === ALL || r.status === statusFilter)
    && (typeFilter === ALL || r.requestType === typeFilter)
    && (assigneeFilter === ALL || r.assignedToStaffId === assigneeFilter),
  );

  async function handleCreate() {
    if (!form.clientId || !form.title.trim()) return;
    setCreating(true);
    const result = await createRequestAction({
      clientId: form.clientId,
      title: form.title,
      description: form.description || undefined,
      requestType: form.requestType,
      dueDate: form.dueDate || undefined,
    });
    setCreating(false);
    if (result.ok) {
      setForm(EMPTY_FORM);
      window.location.reload();
    } else {
      alert(result.error);
    }
  }

  async function handleStatusChange(requestId: string, status: RequestStatus) {
    setPendingId(requestId);
    const result = await updateRequestStatusAction(requestId, status);
    setPendingId(null);
    if (result.ok) {
      setRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, status } : r)));
    } else {
      alert(result.error);
    }
  }

  async function handleAssign(requestId: string, staffId: string) {
    setPendingId(requestId);
    const result = await assignRequestAction(requestId, staffId);
    setPendingId(null);
    if (result.ok) {
      setRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, assignedToStaffId: staffId } : r)));
    } else {
      alert(result.error);
    }
  }

  return (
    <div className="space-y-8">
      <div className="border rounded-md p-4 space-y-3">
        <h2 className="font-medium">New Request</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <select className="border rounded px-2 py-1.5 text-sm" value={form.clientId}
            onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}>
            <option value="">Select client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{clientDisplayName(c.firstName, c.lastName, c.partnerFirstName, c.partnerLastName)}</option>
            ))}
          </select>
          <select className="border rounded px-2 py-1.5 text-sm" value={form.requestType}
            onChange={(e) => setForm((f) => ({ ...f, requestType: e.target.value as RequestType }))}>
            {REQUEST_TYPES.map((t) => <option key={t} value={t}>{REQUEST_TYPE_LABELS[t]}</option>)}
          </select>
          <input className="border rounded px-2 py-1.5 text-sm sm:col-span-2" placeholder="Title"
            value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <textarea className="border rounded px-2 py-1.5 text-sm sm:col-span-2" placeholder="Description (optional)"
            value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <input type="date" className="border rounded px-2 py-1.5 text-sm" value={form.dueDate}
            onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
        </div>
        <button className="border rounded px-3 py-1.5 text-sm disabled:opacity-50"
          onClick={handleCreate} disabled={creating || !form.clientId || !form.title.trim()}>
          {creating ? "Creating…" : "Create Request"}
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-medium">Requests ({filtered.length})</h2>
          <div className="flex items-center gap-2">
            <select className="border rounded px-2 py-1 text-xs" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value={ALL}>All statuses</option>
              {REQUEST_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
            <select className="border rounded px-2 py-1 text-xs" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value={ALL}>All types</option>
              {REQUEST_TYPES.map((t) => <option key={t} value={t}>{REQUEST_TYPE_LABELS[t]}</option>)}
            </select>
            <select className="border rounded px-2 py-1 text-xs" value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
              <option value={ALL}>Anyone assigned</option>
              {teamMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        </div>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No requests match these filters.</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b">
                <th className="py-1.5 pr-3">Title</th>
                <th className="py-1.5 pr-3">Client</th>
                <th className="py-1.5 pr-3">Type</th>
                <th className="py-1.5 pr-3">Origin</th>
                <th className="py-1.5 pr-3">Due Date</th>
                <th className="py-1.5 pr-3">Status</th>
                <th className="py-1.5 pr-3">Assigned To</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b align-top">
                  <td className="py-1.5 pr-3">
                    <a href={`/requests/${r.id}`} className="font-medium underline">{r.title}</a>
                    {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                  </td>
                  <td className="py-1.5 pr-3">{clientName(r.clientId)}</td>
                  <td className="py-1.5 pr-3">{REQUEST_TYPE_LABELS[r.requestType]}</td>
                  <td className="py-1.5 pr-3 text-xs text-muted-foreground">
                    {r.sourceFeature ? SOURCE_LABELS[r.sourceFeature] ?? r.sourceFeature : "Manual"}
                  </td>
                  <td className="py-1.5 pr-3 text-xs text-muted-foreground">
                    {r.dueDate ? new Date(r.dueDate).toLocaleDateString() : "—"}
                  </td>
                  <td className="py-1.5 pr-3">
                    <select className="border rounded px-1.5 py-1 text-xs" value={r.status}
                      disabled={pendingId === r.id}
                      onChange={(e) => handleStatusChange(r.id, e.target.value as RequestStatus)}>
                      {REQUEST_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                  </td>
                  <td className="py-1.5 pr-3">
                    <select className="border rounded px-1.5 py-1 text-xs" value={r.assignedToStaffId ?? ""}
                      disabled={pendingId === r.id}
                      onChange={(e) => e.target.value && handleAssign(r.id, e.target.value)}>
                      <option value="">{staffName(r.assignedToStaffId)}</option>
                      {teamMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
