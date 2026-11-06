import type { Metadata } from "next";

import { ProductExperience } from "@/components/marketing/product-experience";

export const metadata: Metadata = {
  title: "Product",
  description:
    "Your venue, beautifully connected—run your business, collaborate with clients, and coordinate with vendors in one Hello to Cheers platform.",
};

export default function ProductPage() {
  return <ProductExperience />;
}
