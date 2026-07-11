import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DeleteSeriesButton } from "@/components/communication/delete-series-button";
import { SeriesEnrollments } from "@/components/communication/series-enrollments";
import { SeriesForm } from "@/components/communication/series-form";
import { SeriesStatusToggle } from "@/components/communication/series-status-toggle";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getEnrollments, getSequence } from "@/lib/message-sequences/service";
import { getTemplates } from "@/lib/message-templates/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const s = await getSequence(id);
  return { title: s ? `Edit · ${s.name}` : "Edit Automation" };
}

export default async function EditSeriesPage({ params }: Props) {
  const { id } = await params;
  const [series, templates] = await Promise.all([getSequence(id), getTemplates()]);
  if (!series) notFound();
  const enrollments = await getEnrollments(id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit · ${series.name}`}
        description="Update the steps or who this automation starts for."
        actions={
          <div className="flex items-center gap-2">
            <SeriesStatusToggle seriesId={series.id} status={series.status} />
            <DeleteSeriesButton seriesId={series.id} seriesName={series.name} />
          </div>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Automation editor</CardTitle>
          <CardDescription>Changes to steps only affect enrollments made after you save.</CardDescription>
        </CardHeader>
        <CardContent>
          <SeriesForm series={series} templates={templates} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Enrolled</CardTitle>
          <CardDescription>
            {series.triggerType ? "People join this automation automatically, or you can add someone yourself below." : "This automation is manual only — add people below."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SeriesEnrollments sequenceId={series.id} enrollments={enrollments} />
        </CardContent>
      </Card>
    </div>
  );
}
