import type { Metadata } from "next";
import Link from "next/link";

import { LeadList } from "@/components/leads/lead-list";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";
import { getLeads } from "@/lib/leads/service";

export const metadata: Metadata = { title: "Leads" };

export default async function LeadsPage() {
  const leads = await getLeads();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description="Manage inquiries and track them through your booking pipeline."
        actions={<Button render={<Link href="/leads/new" />}>+ New Inquiry</Button>}
      />
      <LeadList leads={leads} />
    </div>
  );
}
