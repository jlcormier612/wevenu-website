import type { Metadata } from "next";
import Link from "next/link";

import { ContractList } from "@/components/contracts/contract-list";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";
import { getContracts } from "@/lib/contracts/service";

export const metadata: Metadata = { title: "Contracts" };

export default async function ContractsPage() {
  const contracts = await getContracts();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Contracts"
        description="Prepare, send, and track agreements with your clients."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" render={<Link href="/contracts/templates" />}>
              Templates
            </Button>
            <Button render={<Link href="/contracts/new" />}>+ New Contract</Button>
          </div>
        }
      />
      <ContractList contracts={contracts} />
    </div>
  );
}
