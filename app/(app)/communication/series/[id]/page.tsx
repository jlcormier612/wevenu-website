import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SeriesView } from "@/components/communication/series-view";
import { PageHeader } from "@/components/shell/module-placeholder";
import { getEnrollments, getSequence } from "@/lib/message-sequences/service";
import { getTemplates } from "@/lib/message-templates/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const s = await getSequence(id);
  return { title: s ? s.name : "Automation" };
}

export default async function ViewSeriesPage({ params }: Props) {
  const { id } = await params;
  const [series, templates, enrollments] = await Promise.all([
    getSequence(id),
    getTemplates(true),
    getEnrollments(id),
  ]);
  if (!series) notFound();

  const activeEnrollmentCount = enrollments.filter((e) => e.status === "active").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={series.name}
        description="Read-only view of what this automation does and who it reaches."
      />
      <SeriesView
        series={series}
        templates={templates}
        activeEnrollmentCount={activeEnrollmentCount}
      />
    </div>
  );
}
