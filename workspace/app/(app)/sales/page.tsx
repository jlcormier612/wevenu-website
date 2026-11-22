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
  getBoardRelationships,
  getOpenTaskCount,
  getRelationship,
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

  const all = getBoardRelationships().filter(isInSalesView);

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
        description="From first inquiry to subscribed customer."
        action={canEdit ? <AddRelationshipForm /> : undefined}
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex max-w-full flex-wrap gap-2 overflow-x-auto pb-1">
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
                className={active ? "ws-chip-active" : "ws-chip"}
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
            className={view === "pipeline" ? "ws-chip-active" : "ws-chip"}
          >
            Pipeline
          </Link>
          <Link
            href={listHref}
            className={view === "list" ? "ws-chip-active" : "ws-chip"}
          >
            List
          </Link>
        </div>
      </div>

      {view === "pipeline" ? (
        <SalesPipelineBoard relationships={relationships} />
      ) : (
        <Panel>
          <div className="hidden md:block">
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
                      className="font-medium hover:text-[var(--htc-primary)]"
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
                    {r.health
                      ? `${HEALTH_LABELS[r.health]} ${HEALTH_EMOJI[r.health]}`
                      : "—"}
                  </span>,
                  r.planName,
                  yesNo(r.foundingMember),
                  assignee?.name ?? "—",
                  formatRelativeDay(r.lastContactAt),
                  String(tasks),
                ];
              })}
            />
          </div>

          <div className="space-y-3 md:hidden">
            {relationships.length === 0 ? (
              <p className="py-8 text-center text-sm ws-muted">
                No relationships in this view.
              </p>
            ) : (
              relationships.map((r) => {
                const assignee = getTeamMember(r.assignedTeamMemberId);
                const tasks = getOpenTaskCount(r.id);
                const stage = deriveSalesStage(r);
                return (
                  <article key={r.id} className="ws-pipeline-card">
                    <Link
                      href={`/relationships/${r.id}?from=sales`}
                      className="font-medium text-[var(--htc-text)] hover:text-[var(--htc-primary)]"
                    >
                      {r.venue.name}
                    </Link>
                    <p className="mt-1 text-xs ws-muted">
                      {r.venue.city}, {r.venue.state}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <StatusPill>{SALES_STAGE_LABELS[stage]}</StatusPill>
                      <span className="text-xs ws-muted">
                        {r.health
                          ? `${HEALTH_LABELS[r.health]} ${HEALTH_EMOJI[r.health]}`
                          : "—"}
                      </span>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <dt className="ws-muted">Plan</dt>
                        <dd>{r.planName}</dd>
                      </div>
                      <div>
                        <dt className="ws-muted">Owner</dt>
                        <dd>{assignee?.name ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="ws-muted">Last contact</dt>
                        <dd>{formatRelativeDay(r.lastContactAt)}</dd>
                      </div>
                      <div>
                        <dt className="ws-muted">Tasks</dt>
                        <dd>{tasks}</dd>
                      </div>
                    </dl>
                  </article>
                );
              })
            )}
          </div>
        </Panel>
      )}
    </div>
  );
}
