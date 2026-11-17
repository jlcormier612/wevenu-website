import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PaymentScheduleDetail } from "@/components/payments/payment-schedule-detail";
import { listInvoiceActivity } from "@/lib/invoices/activity-history-load";
import { getInvoice } from "@/lib/invoices/service";
import { getPaymentSchedule } from "@/lib/payments/service";
import { getCurrentUserRole, getCurrentVenue } from "@/lib/venue/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const schedule = await getPaymentSchedule(id);
  return { title: schedule?.title ?? "Payment Schedule" };
}

export default async function PaymentScheduleDetailPage({ params }: Props) {
  const { id } = await params;
  const [schedule, currentUserRole, venue] = await Promise.all([
    getPaymentSchedule(id),
    getCurrentUserRole(),
    getCurrentVenue(),
  ]);
  if (!schedule) notFound();
  const invoice = schedule.invoiceId ? await getInvoice(schedule.invoiceId) : null;
  const activity = invoice ? await listInvoiceActivity(invoice.id) : [];
  return (
    <PaymentScheduleDetail
      schedule={schedule}
      invoice={invoice}
      activity={activity}
      currentUserRole={currentUserRole}
      acceptedPaymentMethods={venue?.commercialBookingPrefs?.acceptedPaymentMethods ?? null}
    />
  );
}
