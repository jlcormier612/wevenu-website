/**
 * Authenticated CSV export for a Saved Report — venue-scoped via the
 * normal session (getSavedReport/buildSavedReportCsv both go through
 * getCurrentVenue(), same as every other authenticated read in this app).
 */
import { NextResponse } from "next/server";

import { getSavedReport } from "@/lib/saved-reports/service";
import { buildSavedReportCsv } from "@/lib/saved-reports/export";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getSavedReport(id);
  if (!report) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const csv = await buildSavedReportCsv(report);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${report.name.replace(/[^\w\- ]+/g, "")}.csv"`,
    },
  });
}
