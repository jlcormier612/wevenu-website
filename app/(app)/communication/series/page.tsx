import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/shell/module-placeholder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SEQUENCE_TRIGGER_TYPES } from "@/lib/message-sequences/constants";
import { getSequences } from "@/lib/message-sequences/service";

export const metadata: Metadata = { title: "Automations" };

function triggerLabel(triggerType: string | null): string {
  if (!triggerType) return "Manual only";
  return SEQUENCE_TRIGGER_TYPES.find((t) => t.value === triggerType)?.label ?? triggerType;
}

export default async function SeriesPage() {
  const series = await getSequences();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Automations"
        description="Automated follow-ups that go out on their own — a Welcome Automation for new inquiries, a Reminder Automation before a tour. Communication should never require you to remember what to send next."
        actions={
          <Button render={<Link href="/communication/series/new" />}>+ New Automation</Button>
        }
      />

      {series.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 py-16 text-center">
          <p className="font-heading text-lg font-medium text-heading">No automations yet</p>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Build a set of steps that send automatically — on their own schedule, from your Templates.
          </p>
          <Button render={<Link href="/communication/series/new" />}>+ New Automation</Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {series.map((s) => (
            <Card key={s.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{s.name}</CardTitle>
                  <Badge variant={s.status === "active" ? "success" : "muted"} className="text-[10px]">
                    {s.status === "active" ? "Active" : "Paused"}
                  </Badge>
                </div>
                <CardDescription>{triggerLabel(s.triggerType)}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button size="sm" variant="outline" render={<Link href={`/communication/series/${s.id}/edit`} />}>
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
