import type { Metadata } from "next";

import { ProductExperience } from "@/components/marketing/product-experience";

export const metadata: Metadata = {
  title: "Product",
  description:
    "One connected workspace for how independent venues actually operate—sales, planning, communication, operations, finances, and guest experience.",
};

export default function ProductPage() {
  return <ProductExperience />;
}
