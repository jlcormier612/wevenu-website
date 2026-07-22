import { NextResponse } from "next/server";

import {
  ensureProgram3Data,
  getBrandingSync,
  getCategoriesSync,
  getSequencesSync,
  getTemplatesSync,
  newId,
  saveBranding,
  upsertCategory,
  upsertSequence,
  upsertTemplate,
} from "@/lib/program3/store";
import type {
  BrandingConfig,
  Sequence,
  Template,
  TemplateCategory,
} from "@/lib/program3/types";

export async function GET() {
  await ensureProgram3Data();
  return NextResponse.json({
    templates: getTemplatesSync(),
    sequences: getSequencesSync(),
    categories: getCategoriesSync(),
    branding: getBrandingSync(),
  });
}

export async function POST(request: Request) {
  await ensureProgram3Data();
  const body = (await request.json()) as {
    action?: string;
    template?: Partial<Template>;
    sequence?: Partial<Sequence>;
    category?: Partial<TemplateCategory>;
    branding?: Partial<BrandingConfig>;
  };

  const now = new Date().toISOString();

  if (body.action === "save_template" && body.template) {
    const existing = body.template.id
      ? getTemplatesSync().find((t) => t.id === body.template!.id)
      : undefined;
    const subject = body.template.subject ?? existing?.subject ?? "";
    const templateBody = body.template.body ?? existing?.body ?? "";
    const versions = [...(existing?.versions ?? [])];
    if (
      existing &&
      (existing.subject !== subject || existing.body !== templateBody)
    ) {
      versions.push({
        id: newId("tv"),
        version: versions.length + 1,
        subject,
        body: templateBody,
        createdAt: now,
        note: "Edited in library",
      });
    }
    const template: Template = {
      id: body.template.id || newId("tpl"),
      name: body.template.name || existing?.name || "Untitled template",
      categoryId: body.template.categoryId || existing?.categoryId || "cat_sales",
      subject,
      body: templateBody,
      variables: body.template.variables || existing?.variables || [
        "venue_name",
        "owner_first_name",
        "plan",
      ],
      approval: body.template.approval || existing?.approval || "draft",
      publishStatus: body.template.publishStatus || existing?.publishStatus || "draft",
      versions:
        versions.length > 0
          ? versions
          : [
              {
                id: newId("tv"),
                version: 1,
                subject,
                body: templateBody,
                createdAt: now,
              },
            ],
      sentCount: existing?.sentCount ?? 0,
      openCount: existing?.openCount ?? 0,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    await upsertTemplate(template);
    return NextResponse.json({ ok: true, template });
  }

  if (body.action === "save_sequence" && body.sequence) {
    const existing = body.sequence.id
      ? getSequencesSync().find((s) => s.id === body.sequence!.id)
      : undefined;
    const sequence: Sequence = {
      id: body.sequence.id || newId("seq"),
      name: body.sequence.name || existing?.name || "Untitled sequence",
      description: body.sequence.description ?? existing?.description ?? "",
      categoryId: body.sequence.categoryId || existing?.categoryId || "cat_prospect_nurture",
      steps: body.sequence.steps || existing?.steps || [],
      approval: body.sequence.approval || existing?.approval || "draft",
      targeting: body.sequence.targeting || existing?.targeting || "any",
      timezone:
        body.sequence.timezone || existing?.timezone || "America/New_York",
      active: body.sequence.active ?? existing?.active ?? true,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    await upsertSequence(sequence);
    return NextResponse.json({ ok: true, sequence });
  }

  if (body.action === "create_template" && body.template) {
    const subject = body.template.subject ?? "";
    const templateBody = body.template.body ?? "";
    const template: Template = {
      id: newId("tpl"),
      name: body.template.name || "Untitled template",
      categoryId: body.template.categoryId || "cat_prospect_nurture",
      subject,
      body: templateBody,
      variables: body.template.variables || [
        "venue_name",
        "owner_first_name",
        "plan",
      ],
      approval: body.template.approval || "draft",
      publishStatus: "draft",
      versions: [
        {
          id: newId("tv"),
          version: 1,
          subject,
          body: templateBody,
          createdAt: now,
          note: "Created in library",
        },
      ],
      sentCount: 0,
      openCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    await upsertTemplate(template);
    return NextResponse.json({ ok: true, template });
  }

  if (body.action === "save_category" && body.category) {
    const category: TemplateCategory = {
      id: body.category.id || newId("cat"),
      name: body.category.name || "Category",
      description: body.category.description,
    };
    await upsertCategory(category);
    return NextResponse.json({ ok: true, category });
  }

  if (body.action === "save_branding" && body.branding) {
    const current = getBrandingSync();
    const branding: BrandingConfig = {
      ...current,
      ...body.branding,
      id: current.id,
      updatedAt: now,
    };
    await saveBranding(branding);
    return NextResponse.json({ ok: true, branding });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
