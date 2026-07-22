import { NextResponse } from "next/server";

import { syncRelationshipToProduct } from "@shared/product-sync";

import { actorCan } from "@/lib/program4/session";
import { ensureProgram4Data } from "@/lib/program4/store";

/**
 * Manual Product Sync (Project 10) — Owner / Administrator only.
 * Re-runs or resumes the idempotent provisioning pipeline.
 */
export async function POST(request: Request) {
  await ensureProgram4Data();

  if (!(await actorCan("manage_product_sync"))) {
    return NextResponse.json(
      { error: "You do not have permission to provision product" },
      { status: 403 },
    );
  }

  const body = (await request.json()) as {
    relationshipId?: string;
    force?: boolean;
  };

  if (!body.relationshipId?.trim()) {
    return NextResponse.json({ error: "relationshipId required" }, { status: 400 });
  }

  try {
    const result = await syncRelationshipToProduct(body.relationshipId.trim(), {
      force: Boolean(body.force),
      trigger: "manual",
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Product sync failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
