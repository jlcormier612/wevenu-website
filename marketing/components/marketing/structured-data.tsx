import { marketingStructuredDataGraph } from "@/lib/marketing/seo";

/** Server-rendered JSON-LD for Organization + SoftwareApplication + WebSite. */
export function MarketingStructuredData() {
  const graph = marketingStructuredDataGraph();
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
