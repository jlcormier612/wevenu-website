import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PaymentScheduleDetail } from "@/components/payments/payment-schedule-detail";
import { getInvoice } from "@/lib/invoices/service";
import { getPaymentSchedule } from "@/lib/payments/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const schedule = await getPaymentSchedule(id);
  return { title: schedule?.title ?? "Payment Schedule" };
}

export default async function PaymentScheduleDetailPage({ params }: Props) {
  const { id } = await params;
  const schedule = await getPaymentSchedule(id);
  if (!schedule) notFound();
  const invoice = schedule.invoiceId ? await getInvoice(schedule.invoiceId) : null;
  return <PaymentScheduleDetail schedule={schedule} invoice={invoice} />;
}
