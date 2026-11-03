import { NextResponse } from "next/server";

import { renderCoupleContractPdf } from "@/lib/portal/render-couple-contract-pdf";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });

  const { id } = await context.params;
  const result = await renderCoupleContractPdf(token, id);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

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
