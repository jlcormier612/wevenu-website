import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ContractDetail } from "@/components/contracts/contract-detail";
import { getContractDetail } from "@/lib/contracts/service";
import { isContractFinalized } from "@/lib/contracts/document-integration";
import { createClient } from "@/integrations/supabase/server";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const contract = await getContractDetail(id);
  return { title: contract?.title ?? "Contract" };
}

export default async function ContractDetailPage({ params }: Props) {
  const { id } = await params;
  const contract = await getContractDetail(id);
  if (!contract) notFound();
  const supabase = await createClient();
  const finalized = await isContractFinalized(supabase, id);
  return <ContractDetail contract={contract} finalized={finalized} />;
}
