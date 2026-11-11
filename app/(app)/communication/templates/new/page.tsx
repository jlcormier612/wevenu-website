import type { Metadata } from "next";

import { TemplateForm } from "@/components/communication/template-form";
import { CollectionBackLink } from "@/components/library/collection-back-link";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "New Template" };

export default function NewMessageTemplatePage() {
  return (
    <div className="htc-hospitality-page space-y-5 sm:space-y-6" data-htc-phase12="message-template-new">
      <CollectionBackLink href="/communication/templates" label="Message Templates" />
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader title="New Template" description="Create a reusable email or text message with merge fields." />
      </div>
      <Card className="htc-working-card gap-0 py-0">
        <CardHeader className="py-4">
          <CardTitle>Template editor</CardTitle>
          <CardDescription>
            Use {"{{merge_field}}"} tokens — they&apos;ll be replaced with real data once templates connect to sending in a later phase.
          </CardDescription>
        </CardHeader>
        <CardContent className="py-5">
          <TemplateForm />
        </CardContent>
      </Card>
    </div>
  );
}
