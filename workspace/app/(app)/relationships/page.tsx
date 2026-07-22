import Link from "next/link";

import { AddRelationshipForm } from "@/components/relationships/add-relationship-form";
import { PipelineBoard } from "@/components/relationships/pipeline-board";
import {
  DataTable,
  PageHeader,
  Panel,
  StatusPill,
} from "@/components/shared/ui";
import { getOpenTaskCount, getRelationship, getRelationships, getTeamMember } from "@/lib/data/store";
import { tickWorkflows } from "@/lib/program3/engine";
import { ensureProgram3Data } from "@/lib/program3/store";
import { actorCan } from "@/lib/program4/session";
import { ensureProgram4Data } from "@/lib/program4/store";
import type { RelationshipStatus, WelcomeBackVerifiedStatus } from "@/lib/types";
import {
  formatRelativeDay,
  HEALTH_EMOJI,
  HEALTH_LABELS,
  STATUS_LABELS,
  WELCOME_BACK_LABELS,
  yesNo,
} from "@/lib/utils";

export const metadata = { title: "Relationships" };

const STATUS_FILTERS: { label: string; value: RelationshipStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Inquiry", value: "inquiry" },
  { label: "Walkthrough", value: "walkthrough_scheduled" },
  { label: "Onboarding", value: "onboarding" },
  { label: "Live", value: "live" },
  { label: "Support", value: "support" },
];

const WB_FILTERS: WelcomeBackVerifiedStatus[] = [
  "pending",
  "verified",
  "rejected",
];

function isWbFilter(value: string | undefined): value is WelcomeBackVerifiedStatus {
  return value === "pending" || value === "verified" || value === "rejected";
}

export default async function RelationshipsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; view?: string; wb?: string }>;
}) {
  await ensureProgram4Data();
  await ensureProgram3Data();
  await tickWorkflows(getRelationship);

  const canEdit = await actorCan("edit_relationships");
  const params = await searchParams;
  const statusFilter = (params.status as RelationshipStatus | "all" | undefined) ?? "all";
  const wbFilter = isWbFilter(params.wb) ? params.wb : null;
  const view = params.view === "list" || wbFilter ? "list" : "pipeline";
  const all = getRelationships();

  let relationships =
    statusFilter === "all"
      ? all
      : all.filter((r) => {
          if (statusFilter === "walkthrough_scheduled") {
            return (
              r.status === "walkthrough_requested" ||
              r.status === "walkthrough_scheduled" ||
              r.status === "walkthrough_completed"
            );
          }
          if (statusFilter === "live") {
            return (
              r.status === "live" ||
              r.status === "active_customer" ||
              r.status === "expansion" ||
              r.status === "referral" ||
              r.status === "renewal"
            );
          }
          return r.status === statusFilter;
        });

  if (wbFilter) {
    relationships = relationships.filter(
      (r) => r.welcomeBackRequested && r.welcomeBackVerified === wbFilter,
    );
  }

  const wbQuery = wbFilter ? `&wb=${wbFilter}` : "";
  const listHref =
    statusFilter === "all"
      ? `/relationships?view=list${wbQuery}`
      : `/relationships?view=list&status=${statusFilter}${wbQuery}`;
  const pipelineHref =
    statusFilter === "all"
      ? "/relationships"
      : `/relationships?status=${statusFilter}`;

  return (
    <div>
      <PageHeader
        eyebrow="Relationships"
        title="Every venue, one record"
        description="Status changes. The relationship remains. Use the pipeline to move stages — overlays like Founder and Welcome Back stay on the same record."
        action={canEdit ? <AddRelationshipForm /> : undefined}
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => {
            const active = statusFilter === f.value && !wbFilter;
            const base =
              f.value === "all"
                ? view === "list"
                  ? "/relationships?view=list"
                  : "/relationships"
                : view === "list"
                  ? `/relationships?view=list&status=${f.value}`
                  : `/relationships?status=${f.value}`;
            return (
              <Link
                key={f.value}
                href={base}
                className={
                  active
                    ? "rounded-sm bg-[var(--forest-sage)] px-3 py-1.5 text-sm text-[var(--true-white)]"
                    : "rounded-sm bg-[var(--true-white)] px-3 py-1.5 text-sm text-[var(--forest-sage)] ring-1 ring-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] hover:bg-[var(--header-linen)]"
                }
              >
                {f.label}
              </Link>
            );
          })}
          {WB_FILTERS.map((wb) => {
            const active = wbFilter === wb;
            return (
              <Link
                key={wb}
                href={`/relationships?view=list&wb=${wb}`}
                className={
                  active
                    ? "rounded-sm bg-[var(--forest-sage)] px-3 py-1.5 text-sm text-[var(--true-white)]"
                    : "rounded-sm bg-[var(--true-white)] px-3 py-1.5 text-sm text-[var(--forest-sage)] ring-1 ring-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] hover:bg-[var(--header-linen)]"
                }
              >
                WB {WELCOME_BACK_LABELS[wb]}
              </Link>
            );
          })}
        </div>
        <div className="flex gap-2">
          <Link
            href={pipelineHref}
            className={
              view === "pipeline"
                ? "rounded-sm bg-[var(--soft-sage)]/50 px-3 py-1.5 text-sm"
                : "rounded-sm px-3 py-1.5 text-sm ws-muted hover:text-[var(--forest-sage)]"
            }
          >
            Pipeline
          </Link>
          <Link
            href={listHref}
            className={
              view === "list"
                ? "rounded-sm bg-[var(--soft-sage)]/50 px-3 py-1.5 text-sm"
                : "rounded-sm px-3 py-1.5 text-sm ws-muted hover:text-[var(--forest-sage)]"
            }
          >
            List
          </Link>
        </div>
      </div>

      {wbFilter ? (
        <p className="mb-4 text-sm ws-muted">
          Showing Welcome Back · {WELCOME_BACK_LABELS[wbFilter].toLowerCase()} (
          {relationships.length})
          {" · "}
          <Link
            href="/founding"
            className="text-[var(--heritage-sage)] underline-offset-4 hover:underline"
          >
            Founder Dashboard
          </Link>
        </p>
      ) : null}

      {view === "pipeline" ? (
        <PipelineBoard relationships={relationships} />
      ) : (
        <Panel>
          <DataTable
            headers={[
              "Venue",
              "Stage",
              "Health",
              "Plan",
              "Founder",
              "Owner",
              "Last contact",
              "Tasks",
            ]}
            rows={relationships.map((r) => {
              const assignee = getTeamMember(r.assignedTeamMemberId);
              const tasks = getOpenTaskCount(r.id);
              return [
                <div key={`${r.id}-venue`}>
                  <Link
                    href={`/relationships/${r.id}`}
                    className="font-medium hover:text-[var(--heritage-sage)]"
                  >
                    {r.venue.name}
                  </Link>
                  <p className="mt-0.5 text-xs ws-muted">
                    {r.venue.city}, {r.venue.state}
                  </p>
                </div>,
                <StatusPill key={`${r.id}-status`}>{STATUS_LABELS[r.status]}</StatusPill>,
                <span key={`${r.id}-health`}>
                  {HEALTH_LABELS[r.health]} {HEALTH_EMOJI[r.health]}
                </span>,
                r.planName,
                yesNo(r.foundingMember),
                assignee?.name ?? "—",
                formatRelativeDay(r.lastContactAt),
                String(tasks),
              ];
            })}
          />
        </Panel>
      )}
    </div>
  );
}
