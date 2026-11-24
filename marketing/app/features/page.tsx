import type { Metadata } from "next";

import { FeaturesAssembled } from "@/components/marketing/features-assembled";
import { marketingPageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = marketingPageMetadata({
  title: "Everything Included",
  description:
    "Everything your venue needs—sales, planning, operations, vendors, client and guest experience, financials, and Meet Luv.",
  path: "/features",
});

type SearchParams = Promise<{ collection?: string }>;

export default async function FeaturesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  return <FeaturesAssembled collectionId={params.collection} />;
}
