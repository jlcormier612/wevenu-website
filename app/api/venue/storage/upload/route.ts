/**
 * POST /api/venue/storage/upload
 *
 * Authenticated venue/vendor staff Storage write via user-scoped Supabase
 * client (existing RLS). Replaces browser-direct storage.upload that broke
 * after HttpOnly session cookies (browser client cannot read auth JWT).
 *
 * Form fields:
 *   file (required)
 *   bucket (required)
 *   path — full object path including extension (required unless basePath)
 *   basePath — path without extension; extension derived from file name
 *   upsert — "true" | "false"
 *   scope — "venue" (default) | "vendor"
 *   maxBytes — optional numeric override (capped server-side)
 */
import { NextResponse } from "next/server";

import {
  authorizedStaffStorageUpload,
  type AuthScope,
} from "@/lib/storage/authorized-upload";
import {
  CUSTOMER_UPLOAD_INVALID_MESSAGE,
  customerFacingUploadError,
} from "@/lib/storage/customer-upload-errors";

const HARD_MAX_BYTES = 25 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: CUSTOMER_UPLOAD_INVALID_MESSAGE }, { status: 400 });
    }

    const bucket = form.get("bucket")?.toString()?.trim() ?? "";
    const scopeRaw = form.get("scope")?.toString()?.trim() || "venue";
    const scope: AuthScope = scopeRaw === "vendor" ? "vendor" : "venue";
    const upsert = form.get("upsert")?.toString() === "true";
    const requestedMax = Number(form.get("maxBytes")?.toString() || "");
    const maxBytes = Number.isFinite(requestedMax) && requestedMax > 0
      ? Math.min(requestedMax, HARD_MAX_BYTES)
      : HARD_MAX_BYTES;

    let path = form.get("path")?.toString()?.replace(/^\/+/, "") ?? "";
    const basePath = form.get("basePath")?.toString()?.replace(/^\/+/, "") ?? "";
    if (!path && basePath) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      path = `${basePath}.${ext}`;
    }
    if (!bucket || !path) {
      return NextResponse.json({ ok: false, error: CUSTOMER_UPLOAD_INVALID_MESSAGE }, { status: 400 });
    }

    const result = await authorizedStaffStorageUpload({
      scope,
      bucket,
      path,
      file,
      contentType: file.type || null,
      upsert,
      maxBytes,
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.message }, { status: result.status });
    }

    return NextResponse.json({
      ok: true,
      path: result.path,
      publicUrl: result.publicUrl,
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/venue/storage/upload]", raw);
    return NextResponse.json(
      { ok: false, error: customerFacingUploadError(raw) },
      { status: 500 },
    );
  }
}
