import { NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/hq/crm-service";
import {
  applyMessageTemplateImport,
  applyPlanningImport,
  previewWhiteGloveMaterial,
} from "@/lib/onboarding/white-glove-content-apply";
import type { MessageImportProposal, PlanningTaskProposal } from "@/lib/onboarding/white-glove-content-import";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const actor = await requireAdminUser();
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    venueId?: string;
    materialId?: string;
    kind?: "messages" | "planning";
    action?: "preview" | "apply";
    proposals?: MessageImportProposal[];
    tasks?: PlanningTaskProposal[];
    templateName?: string;
    playbookKind?: "client" | "venue";
  };
  const venueId = body.venueId?.trim() ?? "";
  const materialId = body.materialId?.trim() ?? "";
  if (!venueId || !materialId || (body.kind !== "messages" && body.kind !== "planning")) {
    return NextResponse.json({ error: "Missing venue, material, or import kind." }, { status: 400 });
  }

  if (body.action === "preview") {
    const preview = await previewWhiteGloveMaterial(venueId, materialId, body.kind);
    return NextResponse.json(preview, { status: preview.ok ? 200 : 422 });
  }

  if (body.action === "apply" && body.kind === "messages") {
    const result = await applyMessageTemplateImport(venueId, body.proposals ?? []);
    return NextResponse.json({ ok: true, applied: true, ...result });
  }

  if (body.action === "apply" && body.kind === "planning") {
    const result = await applyPlanningImport(venueId, {
      templateName: body.templateName ?? "",
      kind: body.playbookKind === "venue" ? "venue" : "client",
      tasks: body.tasks ?? [],
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
