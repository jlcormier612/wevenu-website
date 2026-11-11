import type { Metadata } from "next";

import { AutomationsHelp } from "@/components/communication/automations-help";
import { SeriesForm } from "@/components/communication/series-form";
import { CollectionBackLink } from "@/components/library/collection-back-link";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTemplates } from "@/lib/message-templates/service";

export const metadata: Metadata = { title: "New Automation" };

export default async function NewSeriesPage() {
  const templates = await getTemplates();
  return (
    <div className="htc-hospitality-page space-y-5 sm:space-y-6" data-htc-phase12="automations-new">
      <CollectionBackLink href="/communication/series" label="Automations" />
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader
          title="New Automation"
          description="Choose who it starts for, what messages go out, and when. You’ll see a plain-language preview before you save."
        />
      </div>
      <AutomationsHelp />
      <Card className="htc-working-card gap-0 py-0">
        <CardHeader className="py-4">
          <CardTitle>Build your automation</CardTitle>
        </CardHeader>
        <CardContent className="py-5">
          <SeriesForm templates={templates} />
        </CardContent>
      </Card>
    </div>
  );
}
