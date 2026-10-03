import { Badge } from "@/components/ui/badge";
import type { InvoiceStatus } from "@/lib/invoices/types";

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const map: Record<InvoiceStatus, "success" | "warning" | "muted" | "destructive"> = {
    draft: "muted",
    sent: "warning",
    partially_paid: "warning",
    paid: "success",
    void: "destructive",
  };
  const label: Record<InvoiceStatus, string> = {
    draft: "Draft",
    sent: "Issued",
    partially_paid: "Partially Paid",
    paid: "Paid",
    void: "Void",
  };
  return <Badge variant={map[status]}>{label[status]}</Badge>;
}
