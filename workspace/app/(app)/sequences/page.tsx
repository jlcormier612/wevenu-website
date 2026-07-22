import Link from "next/link";

import { SequenceEnrollmentControls } from "@/components/sequences/sequence-controls";
import {
  PageHeader,
  Panel,
  RelationshipLink,
  StatusPill,
} from "@/components/shared/ui";
import { getRelationship } from "@/lib/data/store";
import { tickSequences } from "@/lib/program3/sequence-engine";
import {
  ensureProgram3Data,
  getSequenceEnrollmentsSync,
  getSequencesSync,
  getTemplatesSync,
} from "@/lib/program3/store";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Sequences" };

function scheduleLabel(step: {
  scheduleMode?: string;
  delayHours?: number;
  absoluteAt?: string;
  timezone?: string;
}): string {
  if (step.scheduleMode === "absolute" && step.absoluteAt) {
    return `Absolute ${step.absoluteAt.replace("T", " ")} (${step.timezone || "America/New_York"})`;
  }
  const h = step.delayHours ?? 0;
  return h ? `Relative +${h}h` : "Relative immediate";
}

export default async function SequencesPage() {
  await ensureProgram3Data();
  await tickSequences(getRelationship);

  const sequences = getSequencesSync();
  const templates = getTemplatesSync();
  const enrollments = getSequenceEnrollmentsSync().slice(0, 40);

  return (
    <div>
      <PageHeader
        eyebrow="Sequences"
        title="Nurture & check-in cadences"
        description="Ordered template steps with relative delays or absolute date/time. Enroll from a relationship or here via the library builder."
        action={
          <Link
            href="/communications?tab=library"
            className="rounded-sm bg-[var(--forest-sage)] px-4 py-2 text-sm text-[var(--true-white)] hover:bg-[var(--heritage-sage)]"
          >
            Open library
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {sequences.map((seq) => (
          <Panel key={seq.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-heading text-2xl">{seq.name}</h2>
                <p className="mt-2 text-sm leading-relaxed ws-muted">{seq.description}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <StatusPill tone={seq.active ? "good" : "muted"}>
                  {seq.active ? "Active" : "Inactive"}
                </StatusPill>
                <StatusPill tone="neutral">{seq.targeting}</StatusPill>
              </div>
            </div>
            <p className="mt-4 text-xs ws-muted">
              TZ {seq.timezone} · {seq.steps.length} steps · {seq.approval}
            </p>
            <ol className="mt-4 space-y-2">
              {seq.steps.map((step, i) => {
                const tpl = templates.find((t) => t.id === step.templateId);
                return (
                  <li
                    key={step.id}
                    className="rounded-sm bg-[var(--header-linen)]/50 px-3 py-2 text-sm"
                  >
                    <span className="text-xs ws-muted">
                      {i + 1}. {scheduleLabel(step)}
                    </span>
                    <p className="font-medium">{step.label || tpl?.name}</p>
                  </li>
                );
              })}
            </ol>
          </Panel>
        ))}
      </div>

      <div className="mt-10">
        <PageHeader
          eyebrow="Enrollments"
          title="Active & recent"
          description="Pause, resume, or exit like workflows. Tick runs on this page load and at GET|POST /api/sequences/tick."
        />
        <Panel>
          {enrollments.length === 0 ? (
            <p className="text-sm ws-muted">
              No enrollments yet. Open a relationship and use{" "}
              <strong className="font-medium text-[var(--forest-sage)]">Enroll in sequence</strong>.
            </p>
          ) : (
            <ul className="divide-y divide-[color-mix(in_srgb,var(--taupe-medium)_35%,transparent)]">
              {enrollments.map((enrollment) => {
                const rel = getRelationship(enrollment.relationshipId);
                const due = enrollment.steps[enrollment.currentStepIndex];
                return (
                  <li
                    key={enrollment.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div>
                      <p className="font-medium">{enrollment.sequenceName}</p>
                      <p className="text-sm ws-muted">
                        {rel ? (
                          <RelationshipLink id={rel.id} name={rel.venue.name} />
                        ) : (
                          enrollment.relationshipId
                        )}{" "}
                        · step {Math.min(enrollment.currentStepIndex + 1, enrollment.steps.length)}/
                        {enrollment.steps.length}
                        {due?.scheduledFor
                          ? ` · next ${formatDateTime(due.scheduledFor)}`
                          : ""}
                      </p>
                    </div>
                    <SequenceEnrollmentControls enrollment={enrollment} />
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
