import Link from "next/link";
import { Check, Minus } from "lucide-react";

import { getClients } from "@/lib/clients/service";
import { getImportBatches } from "@/lib/import/batches";
import { getItems } from "@/lib/inventory/service";
import { getLeads } from "@/lib/leads/service";
import { getPackages } from "@/lib/packages/service";
import { getVendors } from "@/lib/vendors/service";
import type { EntityType } from "@/lib/import/types";

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
    { label: "Clients",   count: clients.length,   importPath: "/setup-hub/bring-your-business?stage=clients",   resultPath: "/clients" },
    { label: "Leads",     count: leads.length,     importPath: "/setup-hub/bring-your-business?stage=leads",     resultPath: "/leads"            },
    { label: "Vendors",   count: vendors.length,   importPath: "/setup-hub/bring-your-business?stage=vendors",   resultPath: "/vendors"          },
    { label: "Inventory Templates", count: inventory.length, importPath: "/setup-hub/bring-your-business?stage=planning&kind=inventory", resultPath: "/library/inventory" },
    { label: "Package Templates",   count: packages.length,  importPath: "/setup-hub/bring-your-business?stage=planning&kind=packages",  resultPath: "/packages"  },
  ];

  const history = batches.filter((b) => !b.rolledBackAt);
  const showLive = !stats.every((s) => s.count === 0);

  if (!showLive && history.length === 0) return null;

  return (
    <div className="space-y-4">
      {showLive ? (
        <div className="rounded-sm border border-border bg-card p-4 space-y-3" data-testid="byb-live-totals">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground">In Hello to Cheers now</h2>
            <p className="text-xs text-muted-foreground">
              These counts show the records currently in your venue, whether you added them manually or imported them.
            </p>
          </div>

          <div className="space-y-2">
            {stats.map((s) => (
              <div
                key={s.label}
                className="flex items-center justify-between"
                data-testid={`byb-live-${s.label.toLowerCase().split(" ")[0]}`}
                data-count={s.count}
              >
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
        </div>
      ) : null}

      {history.length > 0 ? (
        <div className="rounded-sm border border-border bg-card p-4 space-y-3">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground">Import history</h2>
            <p className="text-xs text-muted-foreground">
              Each row is one import run — not the live totals above.
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
