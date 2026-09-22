/**
 * Read-only Automation details — describes the real configured automation
 * using buildAutomationBehaviorSummary + live template content.
 */

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AUTOMATION_AUDIENCE_LABELS } from "@/lib/message-sequences/constants";
import { buildAutomationBehaviorSummary } from "@/lib/message-sequences/behavior-summary";
import { audienceForTrigger } from "@/lib/message-sequences/platform-triggers";
import type { MessageSequenceWithSteps, SequenceEnrollment } from "@/lib/message-sequences/types";
import type { MessageTemplate } from "@/lib/message-templates/types";
import { substituteSampleMergeFields } from "@/lib/message-templates/preview";

function whoEntersCopy(series: MessageSequenceWithSteps): string {
  if (!series.triggerType) {
    return "Only people you add yourself.";
  }
  const audience = audienceForTrigger(series.triggerType);
  if (audience === "manual") {
    return "Only people you add yourself.";
  }
  const label = AUTOMATION_AUDIENCE_LABELS[audience]?.title ?? "People";
  return `${label} who match this automation’s starting condition, or anyone you add yourself.`;
}

function enrollmentCountCopy(count: number): string {
  if (count <= 0) return "No one is in this automation right now.";
  if (count === 1) return "1 person currently in this automation.";
  return `${count} people currently in this automation.`;
}

function timingPhrase(offsetDays: number, isFirst: boolean): string {
  if (offsetDays === 0) {
    return isFirst ? "Immediately" : "Immediately after the previous message";
  }
  if (offsetDays === 1) {
    return isFirst
      ? "1 day after they enter this automation"
      : "1 day after the previous message";
  }
  return isFirst
    ? `${offsetDays} days after they enter this automation`
    : `${offsetDays} days after the previous message`;
}

export function SeriesView({
  series,
  templates,
  activeEnrollmentCount,
}: {
  series: MessageSequenceWithSteps;
  templates: MessageTemplate[];
  activeEnrollmentCount: number;
  enrollments?: SequenceEnrollment[];
}) {
  const byId = new Map(templates.map((t) => [t.id, t]));
  const summary = buildAutomationBehaviorSummary({
    name: series.name,
    triggerType: series.triggerType,
    triggerStage: series.triggerStage,
    updatePipelineOnEnroll: series.updatePipelineOnEnroll,
    steps: series.steps.map((s) => ({
      templateId: s.templateId,
      channel: s.channel,
      offsetDays: s.offsetDays,
    })),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1">
            <CardTitle>{series.name}</CardTitle>
            <CardDescription>{summary.paragraph}</CardDescription>
          </div>
          <Badge variant={series.status === "active" ? "success" : "muted"}>
            {series.status === "active" ? "Active" : "Paused"}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">When</p>
              <p className="mt-1 text-sm text-foreground">{summary.lines.starts}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Who</p>
              <p className="mt-1 text-sm text-foreground">{whoEntersCopy(series)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recipients</p>
              <p className="mt-1 text-sm text-foreground">
                Primary email. Partner email, when available.
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">People in this automation</p>
              <p className="mt-1 text-sm text-foreground">{enrollmentCountCopy(activeEnrollmentCount)}</p>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Messages</p>
            {series.steps.length === 0 ? (
              <p className="text-sm text-muted-foreground">No messages are configured yet.</p>
            ) : (
              <ol className="space-y-4">
                {series.steps.map((step, index) => {
                  const template = byId.get(step.templateId);
                  const channelLabel = step.channel === "sms" ? "Text" : "Email";
                  const previewBody =
                    step.channel === "sms"
                      ? template?.smsBody
                      : template?.emailBody;
                  const previewSubject =
                    step.channel === "email" ? template?.emailSubject : null;
                  return (
                    <li key={step.id} className="rounded-lg border border-border p-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">
                          {index + 1}. {template?.name ?? "Message"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {channelLabel} · {timingPhrase(step.offsetDays, index === 0)}
                        </p>
                      </div>
                      {previewSubject ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">Subject:</span>{" "}
                          {substituteSampleMergeFields(previewSubject)}
                        </p>
                      ) : null}
                      {previewBody ? (
                        <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-foreground">
                          {substituteSampleMergeFields(previewBody)}
                        </pre>
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">
                          This step’s message isn’t available anymore.
                        </p>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          <p className="text-sm text-muted-foreground">{summary.lines.stops}</p>

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`/communication/series/${series.id}/edit`}>Edit</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/communication/series">Back to Automations</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
