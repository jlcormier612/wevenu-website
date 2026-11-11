import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OpsIncidentDetail } from "@/components/hq/ops-alerts-panel";
import { getOpsIncident } from "@/lib/hq/ops-incidents";

export const metadata: Metadata = { title: "Ops Alert Detail — Hello to Cheers HQ" };

export default async function OpsAlertDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { incident, events } = await getOpsIncident(id);
  if (!incident) notFound();

  return (
    <div className="space-y-4">
      <Link href="/admin/ops-alerts" className="text-xs text-muted-foreground hover:underline">
        ← All ops alerts
      </Link>
      <OpsIncidentDetail incident={incident} events={events} />
    </div>
  );
}
