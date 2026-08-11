/**
 * Authenticated venue-side Brochure PDF — generated on demand from
 * current data (no Storage, no Document Domain; see lib/brochures/pdf.ts's
 * own comment on why "always current" is correct here). Used by the
 * in-app Preview/Download action.
 */
import { NextResponse } from "next/server";

import { getBrochureRenderData } from "@/lib/brochures/service";
import { generateBrochurePdf } from "@/lib/brochures/pdf";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getBrochureRenderData(id);
  if (!data) return NextResponse.json({ error: "Brochure not found." }, { status: 404 });

  const pdf = await generateBrochurePdf(data);
  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${data.brochure.name.replace(/[^\w\- ]+/g, "")}.pdf"`,
    },
  });
}
