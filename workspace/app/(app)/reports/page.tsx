import {
  PageHeader,
  Panel,
  StatTile,
} from "@/components/shared/ui";
import { getReports } from "@/lib/data/store";
import { formatCurrency, HEALTH_LABELS } from "@/lib/utils";

export const metadata = { title: "Reports" };

export default function ReportsPage() {
  const reports = getReports();

  return (
    <div>
      <PageHeader
        eyebrow="Reports"
        title="A quiet pulse on the business"
        description="Informational Phase 1 numbers — no heavy chart libraries. Enough to see growth and health at a glance."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="MRR" value={formatCurrency(reports.mrrCents)} />
        <StatTile label="ARR" value={formatCurrency(reports.arrCents)} />
        <StatTile
          label="Walkthrough conversion"
          value={`${Math.round(reports.walkthroughConversionRate * 100)}%`}
        />
        <StatTile
          label="White Glove adoption"
          value={`${Math.round(reports.whiteGloveAdoptionRate * 100)}%`}
          hint={`${reports.whiteGloveAdoption} recent`}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <StatTile
          label="Welcome Back conversions"
          value={reports.welcomeBackConversions}
          hint={`${Math.round(reports.welcomeBackConversionRate * 100)}% of requests`}
        />
        <StatTile
          label="White Glove customers"
          value={reports.whiteGloveAdoption}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Panel title="Founder growth">
          <SimpleBars items={reports.founderGrowth} />
        </Panel>
        <Panel title="Subscription growth">
          <SimpleBars items={reports.subscriptionGrowth} />
        </Panel>
      </div>

      <Panel title="Customer health" className="mt-6">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {reports.customerHealth.map((row) => (
            <li key={row.health} className="rounded-sm bg-[var(--warm-gray)] px-4 py-4">
              <p className="ws-eyebrow">{HEALTH_LABELS[row.health]}</p>
              <p className="mt-2 font-heading text-3xl">{row.count}</p>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function SimpleBars({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="space-y-4">
      {items.map((item) => (
        <li key={item.label}>
          <div className="mb-1.5 flex justify-between text-sm">
            <span>{item.label}</span>
            <span className="font-medium">{item.value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-sm bg-[var(--taupe-light)]/50">
            <div
              className="h-full rounded-sm bg-[var(--heritage-sage)]"
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
