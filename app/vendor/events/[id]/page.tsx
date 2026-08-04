import { notFound, redirect } from "next/navigation";

import { VendorEventWorkspace } from "@/components/vendor-app/vendor-event-workspace";
import { getVendorUser } from "@/lib/vendor-auth/service";
import {
  getVendorEventUploads,
  getVendorLibraryDocuments,
} from "@/lib/vendor-documents/service";
import { getVendorEventDetail } from "@/lib/vendor-events/service";

type Tab =
  | "overview"
  | "messages"
  | "timeline"
  | "tasks"
  | "documents"
  | "venueinfo"
  | "notes";

const VALID_TABS = new Set<Tab>([
  "overview", "messages", "timeline", "tasks", "documents", "venueinfo", "notes",
]);

export default async function VendorEventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: tabParam } = await searchParams;
  const vendorUser = await getVendorUser();
  if (!vendorUser) redirect("/login");

  const detail = await getVendorEventDetail(id, vendorUser.vendorId);
  if (!detail) notFound();

  const [library, eventUploads] = await Promise.all([
    getVendorLibraryDocuments(),
    getVendorEventUploads(id),
  ]);

  const initialTab: Tab | undefined =
    tabParam && VALID_TABS.has(tabParam as Tab) ? (tabParam as Tab) : undefined;

  return (
    <VendorEventWorkspace
      detail={detail}
      library={library}
      eventUploads={eventUploads}
      initialTab={initialTab}
    />
  );
}
