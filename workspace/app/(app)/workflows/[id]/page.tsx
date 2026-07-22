import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader, Panel, StatusPill } from "@/components/shared/ui";
import { WorkflowBuilder } from "@/components/workflows/workflow-builder";
import { WorkflowRunControls } from "@/components/workflows/workflow-controls";
import { getRelationship, getTeamMembers } from "@/lib/data/store";
import { tickWorkflows } from "@/lib/program3/engine";
import {
  ensureProgram3Data,
  getSequencesSync,
  getTemplatesSync,
  getWorkflowRunSync,
  getWorkflowRunsSync,
  getWorkflowSync,
} from "@/lib/program3/store";
import { formatDateTime } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await ensureProgram3Data();
  const wf = getWorkflowSync(id);
  return { title: wf?.name ?? "Workflow" };
}

export default async function WorkflowDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ run?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  await ensureProgram3Data();
  await tickWorkflows(getRelationship);

  const workflow = getWorkflowSync(id);
  if (!workflow) notFound();

  const runs = getWorkflowRunsSync({ workflowId: id });
  const focusRun = sp.run ? getWorkflowRunSync(sp.run) : runs[0];
  const templates = getTemplatesSync().map((t) => ({ id: t.id, name: t.name }));
  const sequences = getSequencesSync().map((s) => ({ id: s.id, name: s.name }));
  const teamMembers = getTeamMembers().map((m) => ({ id: m.id, name: m.name }));

  return (
    <div className="space-y-10">
      <div>
        <Link
          href="/workflows"
          className="mb-6 inline-block text-sm text-[var(--heritage-sage)] underline-offset-4 hover:underline"
        >
          ← Workflows
        </Link>
        <PageHeader
          eyebrow="Workflow"
          title={workflow.name}
          description={workflow.description}
        />
      </div>

      {focusRun ? (
        <Panel title="Run viewer">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">
                {getRelationship(focusRun.relationshipId)?.venue.name ??
                  focusRun.relationshipId}
              </p>
              <p className="text-sm ws-muted">
                Enrolled {formatDateTime(focusRun.enrolledAt)} · {focusRun.trigger}
              </p>
            </div>
            <WorkflowRunControls run={focusRun} />
          </div>
          <ol className="space-y-3">
            {focusRun.steps.map((step, i) => (
              <li
                key={step.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-sm bg-[var(--header-linen)]/50 px-4 py-3"
              >
                <div>
                  <p className="text-xs ws-muted">Step {i + 1}</p>
                  <p className="font-medium">{step.label}</p>
                  {step.resultNote ? (
                    <p className="mt-1 text-sm ws-muted">{step.resultNote}</p>
                  ) : null}
                  {step.scheduledAt && step.status === "scheduled" ? (
                    <p className="mt-1 text-xs ws-muted">
                      Due {formatDateTime(step.scheduledAt)}
                    </p>
                  ) : null}
                </div>
                <StatusPill
                  tone={
                    step.status === "completed"
                      ? "good"
                      : step.status === "failed"
                        ? "warn"
                        : "neutral"
                  }
                >
                  {step.status}
                </StatusPill>
              </li>
            ))}
          </ol>
          {runs.length > 1 ? (
            <div className="mt-6 border-t border-[color-mix(in_srgb,var(--taupe-medium)_35%,transparent)] pt-4">
              <p className="ws-eyebrow mb-2">Other runs</p>
              <ul className="space-y-1 text-sm">
                {runs.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/workflows/${id}?run=${r.id}`}
                      className="text-[var(--heritage-sage)] hover:underline"
                    >
                      {getRelationship(r.relationshipId)?.venue.name ?? r.relationshipId}{" "}
                      · {r.status}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Panel>
      ) : (
        <Panel title="Runs">
          <p className="text-sm ws-muted">No runs for this workflow yet.</p>
        </Panel>
      )}

      <div>
        <PageHeader
          eyebrow="Builder"
          title="Edit definition"
          description="Changes apply to future enrollments. Active runs keep their snapshot of steps."
        />
        <WorkflowBuilder
          initial={workflow}
          templates={templates}
          sequences={sequences}
          teamMembers={teamMembers}
        />
      </div>
    </div>
  );
}
