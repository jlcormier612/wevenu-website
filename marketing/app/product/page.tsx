import type { Metadata } from "next";

import { ProductExperience } from "@/components/marketing/product-experience";
import { marketingPageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = marketingPageMetadata({
  title: 'Product',
  description:
    'Your venue, beautifully connected—run your business, collaborate with clients, and coordinate with vendors in one Hello to Cheers platform.',
  path: '/product',
});

export default function ProductPage() {
  return <ProductExperience />;
}
