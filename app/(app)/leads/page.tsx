import type { Metadata } from "next";
import Link from "next/link";

import { LeadList } from "@/components/leads/lead-list";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/ui/filter-bar";
import { LEAD_STATUSES } from "@/lib/leads/constants";
import { getLeads } from "@/lib/leads/service";

export const metadata: Metadata = { title: "Leads" };

type Props = { searchParams: Promise<{ q?: string; status?: string }> };

export default async function LeadsPage({ searchParams }: Props) {
  const { q, status } = await searchParams;
  const leads = await getLeads({ q, status });
  const statusOptions = LEAD_STATUSES.map((s) => ({ value: s.value, label: s.label }));
  return (
    <div className="space-y-5">
      <PageHeader
        title="Leads"
        description="Manage inquiries and track them through your booking pipeline."
        actions={<Button render={<Link href="/leads/new" />}>+ New Inquiry</Button>}
      />
      <FilterBar placeholder="Search leads by name or email…" statusOptions={statusOptions} />
      {(q || status) && (
        <p className="text-xs text-muted-foreground">{leads.length} result{leads.length !== 1 ? "s" : ""}{q ? ` matching "${q}"` : ""}{status ? ` · ${statusOptions.find((s) => s.value === status)?.label}` : ""}</p>
      )}
      <LeadList leads={leads} />
    </div>
  );
}
