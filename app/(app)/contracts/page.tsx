import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ContractList } from "@/components/contracts/contract-list";
import { NavListBodyFallback } from "@/components/shell/nav-list-body-fallback";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";
import { getContractsForWorkflowList } from "@/lib/contracts/service";

export const metadata: Metadata = { title: "Contracts" };

type Props = { searchParams: Promise<{ filter?: string }> };

async function ContractsBodyIsland({ filter }: { filter?: string }) {
  const contracts = await getContractsForWorkflowList();
  return <ContractList contracts={contracts} initialFilter={filter} />;
}

export default async function ContractsPage({ searchParams }: Props) {
  const { filter } = await searchParams;
  return (
    <div
      className="htc-hospitality-page space-y-4 sm:space-y-6"
      data-htc-phase8="contracts"
      data-testid="contracts-streaming-root"
    >
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader
          title="Contracts"
          description="Which contracts need something from me?"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" render={<Link href="/library/contracts" />}>
                Templates
              </Button>
              <Button render={<Link href="/contracts/new" />}>+ New Contract</Button>
            </div>
          }
        />
      </div>
      <Suspense fallback={<NavListBodyFallback label="Loading contracts" />}>
        <ContractsBodyIsland filter={filter} />
      </Suspense>
    </div>
  );
}
