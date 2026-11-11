import { Badge } from "@/components/ui/badge";
import type { InvoiceStatus } from "@/lib/invoices/types";

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const label: Record<InvoiceStatus, string> = {
    draft: "Draft",
    sent: "Issued",
    partially_paid: "Partially Paid",
    paid: "Paid",
    void: "Void",
  };
  // Wave G5 — quiet statuses use eucalyptus Active; void stays destructive; sent stays warning.
  if (status === "draft" || status === "paid" || status === "partially_paid") {
    return <Badge className="htc-badge-active">{label[status]}</Badge>;
  }
  if (status === "void") {
    return <Badge variant="destructive">{label.void}</Badge>;
  }
  return <Badge variant="warning">{label[status]}</Badge>;
}
