import Link from "next/link";
import { Check, Minus } from "lucide-react";

import { getClients } from "@/lib/clients/service";
import { getLeads } from "@/lib/leads/service";
import { getVendors } from "@/lib/vendors/service";

const COMING_SOON = ["Events", "Contracts", "Invoices"];

export async function ImportHealthWidget() {
  const [clients, leads, vendors] = await Promise.all([
    getClients(),
    getLeads(),
    getVendors(),
  ]);

  const stats = [
    { label: "Couples",  count: clients.length, importPath: "/settings/import?type=couples", resultPath: "/clients"  },
    { label: "Leads",    count: leads.length,   importPath: "/settings/import?type=leads",   resultPath: "/leads"    },
    { label: "Vendors",  count: vendors.length, importPath: "/settings/import?type=vendors", resultPath: "/vendors"  },
  ];

  if (stats.every((s) => s.count === 0)) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <h2 className="text-sm font-semibold text-foreground">Import Progress</h2>

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

      <div className="pt-2 border-t border-border space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Coming soon</p>
        {COMING_SOON.map((label) => (
          <div key={label} className="flex items-center gap-2">
            <Minus className="h-3 w-3 text-muted-foreground/40" />
            <span className="text-xs text-muted-foreground/60">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
