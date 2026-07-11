import type { Metadata } from "next";

import { TemplateForm } from "@/components/communication/template-form";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "New Template" };

export default function NewMessageTemplatePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="New Template" description="Create a reusable email or text message with merge fields." />
      <Card>
        <CardHeader>
          <CardTitle>Template editor</CardTitle>
          <CardDescription>
            Use {"{{merge_field}}"} tokens — they&apos;ll be replaced with real data once templates connect to sending in a later phase.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TemplateForm />
        </CardContent>
      </Card>
    </div>
  );
}
