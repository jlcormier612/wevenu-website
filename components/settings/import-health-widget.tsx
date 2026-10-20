import Link from "next/link";
import { Check, Minus } from "lucide-react";

import { getClients } from "@/lib/clients/service";
import { getImportBatches } from "@/lib/import/batches";
import { getItems } from "@/lib/inventory/service";
import { getLeads } from "@/lib/leads/service";
import { getPackages } from "@/lib/packages/service";
import { getVendors } from "@/lib/vendors/service";
import type { EntityType } from "@/lib/import/types";

/** Not importable on this page — send venues to the real workflow. */
const USE_MIGRATION_CENTER: Array<{ label: string; detail: string }> = [
  {
    label: "Events, tours, date holds, and calendar blocks",
    detail: "Import these as CSV in Migration Center (after Calendar & Availability is set up for dated Events).",
  },
  {
    label: "Invoices, payment schedules, and signed agreements",
    detail: "Use Migration Center → Active commitment (and Documents for contract files on a Client or Event).",
  },
];

const ENTITY_HISTORY_LABEL: Record<EntityType, string> = {
  couples: "Clients",
  leads: "Leads",
  vendors: "Vendors",
  inventory: "Inventory templates",
  packages: "Package templates",
};

export async function ImportHealthWidget() {
  const [clients, leads, vendors, inventory, packages, batches] = await Promise.all([
    getClients(),
    getLeads(),
    getVendors(),
    getItems(),
    getPackages(),
    getImportBatches(),
  ]);

  const stats = [
    { label: "Clients",   count: clients.length,   importPath: "/settings/import?type=couples",   resultPath: "/clients"          },
    { label: "Leads",     count: leads.length,     importPath: "/settings/import?type=leads",     resultPath: "/leads"            },
    { label: "Vendors",   count: vendors.length,   importPath: "/settings/import?type=vendors",   resultPath: "/vendors"          },
    { label: "Inventory Templates", count: inventory.length, importPath: "/settings/import?type=inventory", resultPath: "/library/inventory" },
    { label: "Package Templates",   count: packages.length,  importPath: "/settings/import?type=packages",  resultPath: "/packages"  },
  ];

  const history = batches.filter((b) => !b.rolledBackAt);
  const showLive = !stats.every((s) => s.count === 0);

  if (!showLive && history.length === 0) return null;

  return (
    <div className="space-y-4">
      {showLive ? (
        <div className="rounded-sm border border-border bg-card p-4 space-y-3">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground">In Hello to Cheers now</h2>
            <p className="text-xs text-muted-foreground">
              Live counts of records in this venue. These are not import-history totals — a client added by hand counts here the same as a client brought in by CSV.
            </p>
          </div>

          <div className="space-y-2">
            {stats.map((s) => (
              <div key={s.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {s.count > 0
                    ? <Check className="h-3.5 w-3.5 text-success" />
                    : <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
                  <span className="text-sm text-foreground">{s.label}</span>
                  {s.count > 0 && (
                    <span className="text-xs text-muted-foreground">({s.count})</span>
                  )}
                </div>
                {s.count > 0
                  ? <Link href={s.resultPath} className="text-xs text-primary hover:underline">View →</Link>
                  : <Link href={s.importPath} className="text-xs text-muted-foreground hover:text-primary hover:underline">Import →</Link>}
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-border space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Not on Import Data — use{" "}
              <Link href="/settings/migration" className="text-primary hover:underline">
                Migration Center
              </Link>
            </p>
            {USE_MIGRATION_CENTER.map((item) => (
              <div key={item.label} className="space-y-0.5 pl-0.5">
                <div className="flex items-start gap-2">
                  <Minus className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/50" />
                  <div>
                    <p className="text-xs text-foreground">{item.label}</p>
                    <p className="text-[11px] text-muted-foreground">{item.detail}</p>
                  </div>
                </div>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground">
              Standalone payment CSV and retired key-date imports are not available. Package and inventory
              templates stay on this Import Data page.
            </p>
          </div>
        </div>
      ) : null}

      {history.length > 0 ? (
        <div className="rounded-sm border border-border bg-card p-4 space-y-3">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground">CSV import history</h2>
            <p className="text-xs text-muted-foreground">
              Each row is one CSV import run, from import history — not the live totals above. Migration Center has its own session history.
            </p>
          </div>
          <div className="space-y-2">
            {history.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-foreground">
                  {ENTITY_HISTORY_LABEL[b.entityType]}
                  {b.sourceLabel ? ` · ${b.sourceLabel}` : ""}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {b.importedCount} imported
                  {b.skippedCount > 0 ? ` · ${b.skippedCount} skipped` : ""}
                  {b.errorCount > 0 ? ` · ${b.errorCount} errors` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
