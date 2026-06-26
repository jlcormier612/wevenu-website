import type { Metadata } from "next";

import { ModulePlaceholder } from "@/components/shell/module-placeholder";

export const metadata: Metadata = { title: "Payments" };

export default function PaymentsPage() {
  return (
    <ModulePlaceholder
      title="Payments"
      description="Track deposits, installments and balances via Stripe Connect."
    />
  );
}
