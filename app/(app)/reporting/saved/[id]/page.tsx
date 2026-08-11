import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { createClient } from "@/integrations/supabase/server";
import { SavedReportDetail } from "@/components/reporting/saved-report-detail";
import { getSavedReport, getScheduleForReport } from "@/lib/saved-reports/service";
import { getCurrentUserRole } from "@/lib/venue/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const report = await getSavedReport(id);
  return { title: report?.name ?? "Saved Report" };
}

export default async function SavedReportDetailPage({ params }: Props) {
  const { id } = await params;
  const [report, schedule, role, supabase] = await Promise.all([
    getSavedReport(id), getScheduleForReport(id), getCurrentUserRole(), createClient(),
  ]);
  if (!report) notFound();
  const { data: { user } } = await supabase.auth.getUser();
  const canSchedule = role === "owner" || role === "manager";

  return (
    <SavedReportDetail
      report={report}
      schedule={schedule}
      canSchedule={canSchedule}
      defaultRecipientEmail={user?.email ?? ""}
    />
  );
}
