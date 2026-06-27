import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ContractDetail } from "@/components/contracts/contract-detail";
import { getContractDetail } from "@/lib/contracts/service";

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
  return <ContractDetail contract={contract} />;
}
