/**
 * Public Brochure PDF — no auth, token-validated entirely inside
 * getBrochureRenderDataByToken's SECURITY DEFINER RPC. The "leave-behind"
 * a prospect downloads from the public /brochure/[token] page.
 */
import { NextResponse } from "next/server";

import { getBrochureRenderDataByToken } from "@/lib/brochures/service";
import { generateBrochurePdf } from "@/lib/brochures/pdf";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getBrochureRenderDataByToken(token);
  if (!data) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const pdf = await generateBrochurePdf(data);
  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${data.brochure.name.replace(/[^\w\- ]+/g, "")}.pdf"`,
    },
  });
}
