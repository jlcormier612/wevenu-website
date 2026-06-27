import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { STATUS_LABEL } from "@/lib/payments/constants";
import type { PaymentItemStatus } from "@/lib/payments/types";

const VARIANT: Record<PaymentItemStatus, BadgeVariant> = {
  pending:   "muted",
  overdue:   "destructive",
  paid:      "success",
  cancelled: "outline",
};

export function PaymentStatusBadge({ status }: { status: PaymentItemStatus }) {
  return <Badge variant={VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function ScheduleStatusBadge({ status }: {
  status: "complete" | "attention" | "on_track" | "no_payments";
}) {
  const map: Record<string, { label: string; variant: BadgeVariant }> = {
    complete:    { label: "Paid in Full", variant: "success" },
    attention:   { label: "Needs Attention", variant: "destructive" },
    on_track:    { label: "On Track", variant: "default" },
    no_payments: { label: "No Payments", variant: "muted" },
  };
  const { label, variant } = map[status] ?? { label: status, variant: "muted" };
  return <Badge variant={variant}>{label}</Badge>;
}
