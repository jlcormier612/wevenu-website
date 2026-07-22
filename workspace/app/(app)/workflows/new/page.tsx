import Link from "next/link";

import { PageHeader } from "@/components/shared/ui";
import { WorkflowBuilder } from "@/components/workflows/workflow-builder";
import { getTeamMembers } from "@/lib/data/store";
import {
  ensureProgram3Data,
  getSequencesSync,
  getTemplatesSync,
} from "@/lib/program3/store";

export const metadata = { title: "New workflow" };

export default async function NewWorkflowPage() {
  await ensureProgram3Data();
  const templates = getTemplatesSync().map((t) => ({ id: t.id, name: t.name }));
  const sequences = getSequencesSync().map((s) => ({ id: s.id, name: s.name }));
  const teamMembers = getTeamMembers().map((m) => ({ id: m.id, name: m.name }));

  return (
    <div>
      <Link
        href="/workflows"
        className="mb-6 inline-block text-sm text-[var(--heritage-sage)] underline-offset-4 hover:underline"
      >
        ← Workflows
      </Link>
      <PageHeader
        eyebrow="Workflows"
        title="Create a workflow"
        description="Start simple — a trigger and a few steps. Expand details only when you need them."
      />
      <WorkflowBuilder
        templates={templates}
        sequences={sequences}
        teamMembers={teamMembers}
      />
    </div>
  );
}
