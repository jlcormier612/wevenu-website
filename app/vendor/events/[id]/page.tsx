import { notFound, redirect } from "next/navigation";

import { VendorEventWorkspace } from "@/components/vendor-app/vendor-event-workspace";
import { getVendorUser } from "@/lib/vendor-auth/service";
import {
  getVendorEventUploads,
  getVendorLibraryDocuments,
} from "@/lib/vendor-documents/service";
import { getVendorEventDetail } from "@/lib/vendor-events/service";
import { getVendorPackages } from "@/lib/vendor-packages/service";
import { getVendorTaskTemplates } from "@/lib/vendor-task-templates/service";

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
  searchParams: Promise<{ tab?: string; highlight?: string; focus?: string; thread?: string }>;
}) {
  const { id } = await params;
  const { tab: tabParam, highlight: highlightParam, focus: focusParam, thread: threadParam } = await searchParams;
  const vendorUser = await getVendorUser();
  if (!vendorUser) redirect("/login");

  const detail = await getVendorEventDetail(id, vendorUser.vendorId);
  if (!detail) notFound();

  const [library, eventUploads, taskTemplates, packages] = await Promise.all([
    getVendorLibraryDocuments(),
    getVendorEventUploads(id),
    getVendorTaskTemplates(vendorUser.vendorId, { activeOnly: false }),
    getVendorPackages(vendorUser.vendorId),
  ]);

  const initialTab: Tab | undefined =
    tabParam && VALID_TABS.has(tabParam as Tab) ? (tabParam as Tab) : undefined;

  const highlight =
    highlightParam === "checkin" || highlightParam === "documents"
      ? highlightParam
      : null;

  const preferredThread =
    threadParam === "couple" || threadParam === "venue" ? threadParam : null;

  return (
    <VendorEventWorkspace
      detail={detail}
      library={library}
      eventUploads={eventUploads}
      taskTemplates={taskTemplates}
      packages={packages}
      initialTab={initialTab}
      highlight={highlight}
      focusTaskId={focusParam ?? null}
      preferredThread={preferredThread}
    />
  );
}
