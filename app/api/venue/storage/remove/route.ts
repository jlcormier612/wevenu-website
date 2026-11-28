/**
 * POST /api/venue/storage/remove
 *
 * Authenticated venue/vendor staff Storage delete via user-scoped client.
 * Body JSON: { bucket, paths: string[], scope?: "venue"|"vendor" }
 */
import { NextResponse } from "next/server";

import {
  authorizedStaffStorageRemove,
  type AuthScope,
} from "@/lib/storage/authorized-upload";
import {
  CUSTOMER_UPLOAD_INVALID_MESSAGE,
  customerFacingUploadError,
} from "@/lib/storage/customer-upload-errors";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      bucket?: string;
      paths?: string[];
      scope?: string;
    };
    const bucket = body.bucket?.trim() ?? "";
    const paths = Array.isArray(body.paths) ? body.paths : [];
    const scope: AuthScope = body.scope === "vendor" ? "vendor" : "venue";
    if (!bucket || paths.length === 0) {
      return NextResponse.json({ ok: false, error: CUSTOMER_UPLOAD_INVALID_MESSAGE }, { status: 400 });
    }

    const result = await authorizedStaffStorageRemove({ scope, bucket, paths });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.message }, { status: result.status });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/venue/storage/remove]", raw);
    return NextResponse.json(
      { ok: false, error: customerFacingUploadError(raw) },
      { status: 500 },
    );
  }
}
