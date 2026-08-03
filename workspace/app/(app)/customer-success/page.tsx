import Link from "next/link";

import { CustomerSuccessBoard } from "@/components/relationships/customer-success-board";
import {
  DataTable,
  PageHeader,
  Panel,
  StatusPill,
} from "@/components/shared/ui";
import {
  getCommunications,
  getRelationship,
  getRelationships,
  getSubscriptions,
  getTasks,
  getTeamMember,
  getTimelineForRelationship,
} from "@/lib/data/store";
import { tickWorkflows } from "@/lib/program3/engine";
import { ensureProgram3Data } from "@/lib/program3/store";
import { ensureProgram4Data } from "@/lib/program4/store";
import {
  CS_STAGE_COLUMNS,
  CS_STAGE_LABELS,
  HEALTH_BADGE_LABELS,
  deriveCustomerSuccessStage,
  isInCustomerSuccessView,
  toCustomerHealthBadge,
  type CustomerSuccessStage,
} from "@/lib/sales-cs";
import type { Subscription } from "@/lib/types";
import { formatRelativeDay } from "@/lib/utils";
import { computeRelationshipHealth } from "@shared/relationships";

export const metadata = { title: "Customer Success" };

const STAGE_FILTERS: { label: string; value: CustomerSuccessStage | "all" }[] = [
  { label: "All", value: "all" },
  ...CS_STAGE_COLUMNS.map((c) => ({ label: c.label, value: c.stage })),
];

function isCsStageFilter(value: string | undefined): value is CustomerSuccessStage {
  return CS_STAGE_COLUMNS.some((c) => c.stage === value);
}

export default async function CustomerSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; view?: string }>;
}) {
  await ensureProgram4Data();
  await ensureProgram3Data();
  await tickWorkflows(getRelationship);

  const params = await searchParams;
  const stageFilter = isCsStageFilter(params.stage) ? params.stage : "all";
  const view = params.view === "list" ? "list" : "pipeline";
  const all = getRelationships().filter(isInCustomerSuccessView);

  const relationships =
    stageFilter === "all"
      ? all
      : all.filter((r) => deriveCustomerSuccessStage(r) === stageFilter);

  const subscriptionsByRel: Record<string, Subscription | undefined> = {};
  const onboardingProgressByRel: Record<string, number> = {};

  for (const r of relationships) {
    const subs = getSubscriptions(r.id);
    subscriptionsByRel[r.id] = subs[0];
    const health = computeRelationshipHealth(r as never, {
      tasks: getTasks({ relationshipId: r.id }) as never,
      communications: getCommunications({ relationshipId: r.id }) as never,
      timelineEvents: getTimelineForRelationship(r.id) as never,
      subscriptions: subs as never,
    });
    onboardingProgressByRel[r.id] = health.onboardingProgress;
  }

  const listHref =
    stageFilter === "all"
      ? "/customer-success?view=list"
      : `/customer-success?view=list&stage=${stageFilter}`;
  const pipelineHref =
    stageFilter === "all"
      ? "/customer-success"
      : `/customer-success?stage=${stageFilter}`;

  return (
    <div>
      <PageHeader
        eyebrow="Customer Success"
        title="Customer Success"
        description="Every customer. One relationship. One lifecycle."
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {STAGE_FILTERS.map((f) => {
            const active = stageFilter === f.value;
            const base =
              f.value === "all"
                ? view === "list"
                  ? "/customer-success?view=list"
                  : "/customer-success"
                : view === "list"
                  ? `/customer-success?view=list&stage=${f.value}`
                  : `/customer-success?stage=${f.value}`;
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

      {view === "pipeline" ? (
        <CustomerSuccessBoard
          relationships={relationships}
          subscriptionsByRel={subscriptionsByRel}
          onboardingProgressByRel={onboardingProgressByRel}
        />
      ) : (
        <Panel>
          <DataTable
            headers={[
              "Venue",
              "Stage",
              "Health",
              "Plan",
              "MRR",
              "Owner",
              "Last activity",
              "Support",
            ]}
            rows={relationships.map((r) => {
              const assignee = getTeamMember(r.assignedTeamMemberId);
              const stage = deriveCustomerSuccessStage(r);
              const badge = toCustomerHealthBadge(r.health, r.healthScore, {
                suspended: r.status === "suspended",
                accessDisabled: r.accessDisabled,
              });
              const sub = subscriptionsByRel[r.id];
              const lastActivity =
                r.lastCustomerActivityAt || r.lastLoginAt || r.lastContactAt;
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
                <StatusPill key={`${r.id}-status`}>
                  {CS_STAGE_LABELS[stage]}
                </StatusPill>,
                <span key={`${r.id}-health`}>{HEALTH_BADGE_LABELS[badge]}</span>,
                r.planName,
                sub ? `$${(sub.mrrCents / 100).toFixed(0)}` : "—",
                assignee?.name ?? "—",
                lastActivity ? formatRelativeDay(lastActivity) : "—",
                String(r.supportOpenCount || 0),
              ];
            })}
          />
        </Panel>
      )}
    </div>
  );
}
