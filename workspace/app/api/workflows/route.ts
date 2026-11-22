import { NextResponse } from "next/server";

import { getRelationship } from "@/lib/data/store";
import {
  enrollWorkflow,
  exitWorkflowRun,
  pauseWorkflowRun,
  resumeWorkflowRun,
} from "@/lib/program3/engine";
import {
  ensureProgram3Data,
  getWorkflowsSync,
  newId,
  upsertWorkflow,
} from "@/lib/program3/store";
import type { Workflow, WorkflowStep, WorkflowTrigger } from "@/lib/program3/types";
import { requireWorkspaceStaff } from "@/lib/program4/session";

export async function GET() {
  const auth = await requireWorkspaceStaff("view_workflows");
  if (!auth.ok) return auth.response;
  await ensureProgram3Data();
  return NextResponse.json({ workflows: getWorkflowsSync() });
}

export async function POST(request: Request) {
  const auth = await requireWorkspaceStaff("manage_workflows");
  if (!auth.ok) return auth.response;
  await ensureProgram3Data();
  const body = (await request.json()) as {
    action?: string;
    workflowId?: string;
    relationshipId?: string;
    runId?: string;
    reason?: string;
    workflow?: Partial<Workflow> & { name?: string; steps?: WorkflowStep[] };
  };

  if (body.action === "enroll") {
    if (!body.workflowId || !body.relationshipId) {
      return NextResponse.json(
        { error: "workflowId and relationshipId required" },
        { status: 400 },
      );
    }
    const result = await enrollWorkflow({
      workflowId: body.workflowId,
      relationshipId: body.relationshipId,
      trigger: "manual",
      getRelationship,
    });
    if ("error" in result) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json({ ok: true, run: result });
  }

  if (body.action === "pause" && body.runId) {
    const result = await pauseWorkflowRun(body.runId);
    if ("error" in result) return NextResponse.json(result, { status: 400 });
    return NextResponse.json({ ok: true, run: result });
  }

  if (body.action === "resume" && body.runId) {
    const result = await resumeWorkflowRun(body.runId, getRelationship);
    if ("error" in result) return NextResponse.json(result, { status: 400 });
    return NextResponse.json({ ok: true, run: result });
  }

  if (body.action === "exit" && body.runId) {
    const result = await exitWorkflowRun(body.runId, body.reason);
    if ("error" in result) return NextResponse.json(result, { status: 400 });
    return NextResponse.json({ ok: true, run: result });
  }

  if (body.action === "save" && body.workflow) {
    const now = new Date().toISOString();
    const incoming = body.workflow;
    const workflow: Workflow = {
      id: incoming.id || newId("wf"),
      name: incoming.name || "Untitled workflow",
      description: incoming.description || "",
      active: incoming.active ?? true,
      trigger: (incoming.trigger as WorkflowTrigger) || { type: "manual" },
      steps: incoming.steps || [],
      createdAt: incoming.createdAt || now,
      updatedAt: now,
    };
    await upsertWorkflow(workflow);
    return NextResponse.json({ ok: true, workflow });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
