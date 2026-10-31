import { NextResponse } from "next/server";

import {
  renderContractPdfForViewer,
  renderEventOrderPdfForViewer,
} from "@/lib/document-workspace/render-pdf";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ docType: string; id: string }> },
) {
  const { docType, id } = await context.params;
  const result =
    docType === "contract" ? await renderContractPdfForViewer(id)
    : docType === "event_order" ? await renderEventOrderPdfForViewer(id)
    : null;
  if (!result) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });

  const download = new URL(request.url).searchParams.get("download") === "1";
  const body = new Blob([Uint8Array.from(result.bytes)], { type: "application/pdf" });
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(result.filename)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
