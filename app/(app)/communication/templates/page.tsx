import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/shell/module-placeholder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { categoryLabel } from "@/lib/message-templates/constants";
import { getTemplates } from "@/lib/message-templates/service";

export const metadata: Metadata = { title: "Message Templates" };

export default async function MessageTemplatesPage() {
  const templates = await getTemplates();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Templates"
        description="Reusable email and text messages, ready to send from Planning tasks once that connection ships."
        actions={
          <Button render={<Link href="/communication/templates/new" />}>+ New Template</Button>
        }
      />

      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 py-16 text-center">
          <p className="font-heading text-lg font-medium text-heading">No templates yet</p>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Create a reusable email or text message, or bring in one you already send.
          </p>
          <Button render={<Link href="/communication/templates/new" />}>+ New Template</Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{t.name}</CardTitle>
                  <div className="flex shrink-0 items-center gap-1">
                    {t.emailBody && <Badge variant="muted" className="text-[10px]">Email</Badge>}
                    {t.smsBody && <Badge variant="muted" className="text-[10px]">SMS</Badge>}
                  </div>
                </div>
                <CardDescription>{categoryLabel(t.category)}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button size="sm" variant="outline" render={<Link href={`/communication/templates/${t.id}/edit`} />}>
                  Edit
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
