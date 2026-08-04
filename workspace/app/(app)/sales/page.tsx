import Link from "next/link";

import { AddRelationshipForm } from "@/components/relationships/add-relationship-form";
import { AutoArrivalBadge } from "@/components/relationships/auto-arrival-badge";
import { SalesPipelineBoard } from "@/components/relationships/sales-pipeline-board";
import {
  DataTable,
  PageHeader,
  Panel,
  StatusPill,
} from "@/components/shared/ui";
import {
  getOpenTaskCount,
  getRelationship,
  getRelationships,
  getTeamMember,
} from "@/lib/data/store";
import { tickWorkflows } from "@/lib/program3/engine";
import { ensureProgram3Data } from "@/lib/program3/store";
import { actorCan } from "@/lib/program4/session";
import { ensureProgram4Data } from "@/lib/program4/store";
import {
  SALES_STAGE_COLUMNS,
  SALES_STAGE_LABELS,
  countAutoArrivalsForStage,
  deriveSalesStage,
  isInSalesView,
  isSalesAutoArrivalStage,
  type SalesStage,
} from "@/lib/sales-cs";
import {
  formatRelativeDay,
  HEALTH_EMOJI,
  HEALTH_LABELS,
  yesNo,
} from "@/lib/utils";
import {
  acknowledgeStageAutoArrivals,
  hasLiveRelationshipsSync,
} from "@shared/relationships";

export const metadata = { title: "Sales" };

const STAGE_FILTERS: { label: string; value: SalesStage | "all" }[] = [
  { label: "All", value: "all" },
  ...SALES_STAGE_COLUMNS.map((c) => ({
    label: c.label,
    value: c.stage,
  })),
];

function isSalesStageFilter(value: string | undefined): value is SalesStage {
  return SALES_STAGE_COLUMNS.some((c) => c.stage === value);
}

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; view?: string }>;
}) {
  await ensureProgram4Data();
  await ensureProgram3Data();
  await tickWorkflows(getRelationship);

  const canEdit = await actorCan("edit_relationships");
  const params = await searchParams;
  const stageFilter = isSalesStageFilter(params.stage) ? params.stage : "all";
  const view = params.view === "list" ? "list" : "pipeline";

  // Acknowledge filter chip / column stage so the highlight clears.
  if (
    stageFilter !== "all" &&
    isSalesAutoArrivalStage(stageFilter) &&
    hasLiveRelationshipsSync()
  ) {
    await acknowledgeStageAutoArrivals("sales", stageFilter).catch(() => null);
  }

  const all = getRelationships().filter(isInSalesView);

  const relationships =
    stageFilter === "all"
      ? all
      : all.filter((r) => deriveSalesStage(r) === stageFilter);

  const listHref =
    stageFilter === "all"
      ? "/sales?view=list"
      : `/sales?view=list&stage=${stageFilter}`;
  const pipelineHref =
    stageFilter === "all" ? "/sales" : `/sales?stage=${stageFilter}`;

  return (
    <div>
      <PageHeader
        eyebrow="Sales"
        title="Every venue, one record"
        description="Convert inquiries to subscribed. Closed Won stays on this board after subscribe — the same record also appears in Customer Success. Dragging to Closed Won does not enter CS; only a successful Stripe subscribe does."
        action={canEdit ? <AddRelationshipForm /> : undefined}
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {STAGE_FILTERS.map((f) => {
            const active = stageFilter === f.value;
            const base =
              f.value === "all"
                ? view === "list"
                  ? "/sales?view=list"
                  : "/sales"
                : view === "list"
                  ? `/sales?view=list&stage=${f.value}`
                  : `/sales?stage=${f.value}`;
            const newCount =
              f.value !== "all"
                ? countAutoArrivalsForStage(
                    all.filter((r) => deriveSalesStage(r) === f.value),
                    f.value,
                    "sales",
                  )
                : 0;
            return (
              <Link
                key={f.value}
                href={base}
                className={
                  active
                    ? "inline-flex items-center rounded-sm bg-[var(--forest-sage)] px-3 py-1.5 text-sm text-[var(--true-white)]"
                    : "inline-flex items-center rounded-sm bg-[var(--true-white)] px-3 py-1.5 text-sm text-[var(--forest-sage)] ring-1 ring-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] hover:bg-[var(--header-linen)]"
                }
              >
                {f.label}
                <AutoArrivalBadge count={newCount} active={active} />
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
        <SalesPipelineBoard relationships={relationships} />
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
              const stage = deriveSalesStage(r);
              return [
                <div key={`${r.id}-venue`}>
                  <Link
                    href={`/relationships/${r.id}?from=sales`}
                    className="font-medium hover:text-[var(--heritage-sage)]"
                  >
                    {r.venue.name}
                  </Link>
                  <p className="mt-0.5 text-xs ws-muted">
                    {r.venue.city}, {r.venue.state}
                  </p>
                </div>,
                <StatusPill key={`${r.id}-status`}>
                  {SALES_STAGE_LABELS[stage]}
                </StatusPill>,
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
