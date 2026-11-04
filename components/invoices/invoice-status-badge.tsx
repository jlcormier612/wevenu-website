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
  // Wave G3 — quiet statuses use eucalyptus; attention keeps warning; void stays destructive.
  if (status === "draft") {
    return <Badge className="htc-badge-active">{label.draft}</Badge>;
  }
  if (status === "paid") {
    return <Badge className="htc-badge-active">{label.paid}</Badge>;
  }
  if (status === "void") {
    return <Badge variant="destructive">{label.void}</Badge>;
  }
  return <Badge variant="warning">{label[status]}</Badge>;
}
