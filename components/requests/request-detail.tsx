"use client";

/**
 * RequestDetail — the venue's single-record Request view. This is the
 * "existing Request record" other features (Planning today) navigate to;
 * request editing lives only here, never duplicated inside a feature
 * (Wedding Workspace – Request Experience, Phase 1 completes this from the
 * Request Framework Foundation's internal-only starting point).
 */
import * as React from "react";

import {
  assignRequestAction, setClientActionEnabledAction, updateRequestStatusAction,
} from "@/app/(app)/requests/actions";
import { clientDisplayName } from "@/lib/clients/constants";
import type { Client } from "@/lib/clients/types";
import {
  REQUEST_STATUSES, REQUEST_TYPE_LABELS, STATUS_LABELS, VISIBILITY_LABELS,
} from "@/lib/requests/constants";
import type { Request, RequestLifecycleEventRecord, RequestStatus } from "@/lib/requests/types";
import type { StaffMember } from "@/lib/team/types";

const SOURCE_LABELS: Record<string, string> = {
  planning: "Planning", timeline: "Timeline", documents: "Documents",
  contracts: "Contracts", floor_plans: "Floor Plans", guests: "Guest List", manual: "Manual",
};

// Origin → the Booking Workspace's own anchor for that feature, so "Open
// Related Item" never duplicates the originating UI, just scrolls to it.
const SOURCE_ANCHORS: Record<string, string> = {
  planning: "planning-task-list",
};

export function RequestDetail({
  initialRequest, clients, teamMembers, initialHistory,
}: { initialRequest: Request; clients: Client[]; teamMembers: StaffMember[]; initialHistory: RequestLifecycleEventRecord[] }) {
  const [request, setRequest] = React.useState(initialRequest);
  const [pending, setPending] = React.useState(false);
  const history = initialHistory;

  const client = clients.find((c) => c.id === request.clientId);
  const clientName = client
    ? clientDisplayName(client.firstName, client.lastName, client.partnerFirstName, client.partnerLastName)
    : request.clientId;
  const assignee = teamMembers.find((m) => m.id === request.assignedToStaffId);
  const anchor = request.sourceFeature ? SOURCE_ANCHORS[request.sourceFeature] : undefined;

  async function handleStatusChange(status: RequestStatus) {
    setPending(true);
    const result = await updateRequestStatusAction(request.id, status);
    setPending(false);
    if (result.ok) setRequest((r) => ({ ...r, status }));
    else alert(result.error);
  }

  async function handleAssign(staffId: string) {
    setPending(true);
    const result = await assignRequestAction(request.id, staffId);
    setPending(false);
    if (result.ok) setRequest((r) => ({ ...r, assignedToStaffId: staffId }));
    else alert(result.error);
  }

  async function handleToggleClientAction() {
    setPending(true);
    const enabled = !request.clientActionEnabled;
    const result = await setClientActionEnabledAction(request.id, enabled);
    setPending(false);
    if (result.ok) setRequest((r) => ({ ...r, clientActionEnabled: enabled }));
    else alert(result.error);
  }

  return (
    <div className="space-y-4 max-w-xl">
      <div>
        <h1 className="text-xl font-semibold">{request.title}</h1>
        {request.description && <p className="text-sm text-muted-foreground mt-1">{request.description}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Client</p>
          <p>{clientName}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Type</p>
          <p>{REQUEST_TYPE_LABELS[request.requestType]}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Visibility</p>
          <p>{VISIBILITY_LABELS[request.visibility]}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Due Date</p>
          <p>{request.dueDate ? new Date(request.dueDate).toLocaleDateString() : "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Origin</p>
          <p>{request.sourceFeature ? SOURCE_LABELS[request.sourceFeature] ?? request.sourceFeature : "Manual"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Created</p>
          <p>{new Date(request.createdAt).toLocaleDateString()}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Reviewed</p>
          <p>{request.reviewedAt ? new Date(request.reviewedAt).toLocaleDateString() : "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Completed</p>
          <p>{request.completedAt ? new Date(request.completedAt).toLocaleDateString() : "—"}</p>
        </div>
      </div>

      {request.eventId && anchor && (
        <a href={`/events/${request.eventId}#${anchor}`} className="text-sm underline">
          Open Related Item →
        </a>
      )}

      {(request.responseText || request.responseFileUrl) && (
        <div className="border rounded-md p-3 space-y-1 bg-muted/20">
          <p className="text-xs font-medium text-muted-foreground">Client&apos;s response</p>
          {request.responseText && <p className="text-sm">{request.responseText}</p>}
          {request.responseFileUrl && (
            <a href={request.responseFileUrl} target="_blank" rel="noopener noreferrer" className="text-sm underline">
              View uploaded file
            </a>
          )}
        </div>
      )}

      {/* Quick actions — reuse the same lifecycle the status dropdown below uses */}
      <div className="flex flex-wrap gap-2">
        <button className="border rounded px-3 py-1.5 text-xs disabled:opacity-50" disabled={pending}
          onClick={() => handleStatusChange("reviewed")}>Review</button>
        <button className="border rounded px-3 py-1.5 text-xs disabled:opacity-50" disabled={pending}
          onClick={() => handleStatusChange("in_progress")}>Return for Revision</button>
        <button className="border rounded px-3 py-1.5 text-xs disabled:opacity-50" disabled={pending}
          onClick={() => handleStatusChange("completed")}>Complete</button>
        <button className="border rounded px-3 py-1.5 text-xs text-destructive disabled:opacity-50" disabled={pending}
          onClick={() => handleStatusChange("cancelled")}>Cancel</button>
      </div>

      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Status</p>
        <select className="border rounded px-2 py-1.5 text-sm" value={request.status} disabled={pending}
          onChange={(e) => handleStatusChange(e.target.value as RequestStatus)}>
          {REQUEST_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
      </div>

      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Assigned To</p>
        <select className="border rounded px-2 py-1.5 text-sm" value={request.assignedToStaffId ?? ""} disabled={pending}
          onChange={(e) => e.target.value && handleAssign(e.target.value)}>
          <option value="">{assignee?.name ?? "Unassigned"}</option>
          {teamMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={request.clientActionEnabled} disabled={pending} onChange={handleToggleClientAction} />
        Client can act on this request
      </label>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">History</p>
        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground">No activity yet.</p>
        ) : (
          <ul className="space-y-1">
            {history.map((h) => (
              <li key={h.id} className="text-xs text-muted-foreground flex items-center gap-2">
                <span>{h.eventType === "created" ? "Created" : h.fromStatus ? `${h.fromStatus} → ${h.toStatus}` : h.eventType}</span>
                <span className="ml-auto">{new Date(h.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
