import type { Metadata } from "next";

import { SeriesForm } from "@/components/communication/series-form";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getTemplates } from "@/lib/message-templates/service";

export const metadata: Metadata = { title: "New Automation" };

export default async function NewSeriesPage() {
  const templates = await getTemplates();
  return (
    <div className="space-y-6">
      <PageHeader title="New Automation" description="Build a set of steps that send automatically, in order, from your Templates." />
      <Card>
        <CardHeader>
          <CardTitle>Automation editor</CardTitle>
          <CardDescription>
            Choose what starts it, then add steps. Each step sends a Template on its own schedule after the one before it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SeriesForm templates={templates} />
        </CardContent>
      </Card>
    </div>
  );
}
