import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AutomationsHelp } from "@/components/communication/automations-help";
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
  const [series, templates] = await Promise.all([
    getSequence(id),
    getTemplates(),
  ]);
  if (!series) notFound();
  const enrollments = await getEnrollments(id);
  const activeCount = enrollments.filter((e) => e.status === "active").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={series.name}
        description="Review who this is for, what will happen, and who is currently receiving messages."
        actions={
          <div className="flex items-center gap-2">
            <SeriesStatusToggle seriesId={series.id} status={series.status} />
            <DeleteSeriesButton seriesId={series.id} seriesName={series.name} />
          </div>
        }
      />
      <AutomationsHelp />
      <Card>
        <CardHeader>
          <CardTitle>Automation</CardTitle>
          <CardDescription>
            Changes to messages only affect people who join after you save. Preview updates as you edit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SeriesForm series={series} templates={templates} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>People in this automation</CardTitle>
          <CardDescription>
            {series.triggerType
              ? `People can join automatically, or you can add someone yourself. ${activeCount} active right now.`
              : `This automation only starts when you add someone. ${activeCount} active right now.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SeriesEnrollments sequenceId={series.id} enrollments={enrollments} />
        </CardContent>
      </Card>
    </div>
  );
}
