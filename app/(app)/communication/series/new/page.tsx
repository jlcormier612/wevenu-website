import type { Metadata } from "next";

import { AutomationsHelp } from "@/components/communication/automations-help";
import { SeriesForm } from "@/components/communication/series-form";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getTemplates } from "@/lib/message-templates/service";

export const metadata: Metadata = { title: "New Automation" };

export default async function NewSeriesPage() {
  const templates = await getTemplates();
  return (
    <div className="htc-hospitality-page space-y-5 sm:space-y-6" data-htc-phase12="automations-new">
      <div className="htc-hospitality-intro">
        <PageHeader
          title="New Automation"
          description="Choose who it starts for, what messages go out, and when. You’ll see a plain-language preview before you save."
        />
      </div>
      <AutomationsHelp />
      <Card>
        <CardHeader>
          <CardTitle>Build your automation</CardTitle>
          <CardDescription>
            Keep it simple: who it starts for → what happens → when it stops. Use your existing Templates for the message content.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SeriesForm templates={templates} />
        </CardContent>
      </Card>
    </div>
  );
}
