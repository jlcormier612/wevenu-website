import Link from "next/link";

import { PageHeader, Panel, StatusPill } from "@/components/shared/ui";
import { getRelationship } from "@/lib/data/store";
import { tickWorkflows } from "@/lib/program3/engine";
import {
  ensureProgram3Data,
  getWorkflowRunsSync,
  getWorkflowsSync,
} from "@/lib/program3/store";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Workflows" };

export default async function WorkflowsPage() {
  await ensureProgram3Data();
  await tickWorkflows(getRelationship);

  const workflows = getWorkflowsSync();
  const runs = getWorkflowRunsSync().slice(0, 20);

  return (
    <div>
      <PageHeader
        eyebrow="Workflows"
        title="Automated care paths"
        description="Enroll a relationship when status changes — or start one by hand. Emails are simulated until SMTP is connected."
        action={
          <Link
            href="/workflows/new"
            className="rounded-sm bg-[var(--forest-sage)] px-4 py-2 text-sm text-[var(--true-white)] hover:bg-[var(--heritage-sage)]"
          >
            New workflow
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {workflows.map((wf) => (
          <Panel key={wf.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link
                  href={`/workflows/${wf.id}`}
                  className="font-heading text-2xl hover:text-[var(--heritage-sage)]"
                >
                  {wf.name}
                </Link>
                <p className="mt-2 text-sm leading-relaxed ws-muted">{wf.description}</p>
              </div>
              <StatusPill tone={wf.active ? "good" : "muted"}>
                {wf.active ? "Active" : "Inactive"}
              </StatusPill>
            </div>
            <p className="mt-4 text-xs ws-muted">
              Trigger:{" "}
              {wf.trigger.type === "manual"
                ? "Manual"
                : `Enter ${wf.trigger.status.replace(/_/g, " ")}`}
              {" · "}
              {wf.steps.length} steps
            </p>
            <Link
              href={`/workflows/${wf.id}`}
              className="mt-4 inline-block text-sm text-[var(--heritage-sage)] underline-offset-4 hover:underline"
            >
              Open builder & runs →
            </Link>
          </Panel>
        ))}
      </div>

      <div className="mt-10">
        <PageHeader
          eyebrow="Runs"
          title="Recent enrollments"
          description="Pause, resume, or exit from the run detail on each workflow."
        />
        <Panel>
          {runs.length === 0 ? (
            <p className="text-sm ws-muted">
              No runs yet. Move a relationship into Inquiry, or enroll manually from a
              relationship workspace.
            </p>
          ) : (
            <ul className="divide-y divide-[color-mix(in_srgb,var(--taupe-medium)_35%,transparent)]">
              {runs.map((run) => {
                const rel = getRelationship(run.relationshipId);
                return (
                  <li
                    key={run.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div>
                      <p className="font-medium">{run.workflowName}</p>
                      <p className="text-sm ws-muted">
                        {rel?.venue.name ?? run.relationshipId} · {run.trigger} ·{" "}
                        {formatDateTime(run.enrolledAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusPill>{run.status}</StatusPill>
                      <Link
                        href={`/workflows/${run.workflowId}?run=${run.id}`}
                        className="text-sm text-[var(--heritage-sage)] hover:underline"
                      >
                        View
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
