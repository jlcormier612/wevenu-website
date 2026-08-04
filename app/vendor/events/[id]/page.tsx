import { notFound, redirect } from "next/navigation";

import { VendorEventWorkspace } from "@/components/vendor-app/vendor-event-workspace";
import { getVendorUser } from "@/lib/vendor-auth/service";
import {
  getVendorEventUploads,
  getVendorLibraryDocuments,
} from "@/lib/vendor-documents/service";
import { getVendorEventDetail } from "@/lib/vendor-events/service";

export default async function VendorEventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const vendorUser = await getVendorUser();
  if (!vendorUser) redirect("/login");

  const detail = await getVendorEventDetail(id, vendorUser.vendorId);
  if (!detail) notFound();

  const [library, eventUploads] = await Promise.all([
    getVendorLibraryDocuments(),
    getVendorEventUploads(id),
  ]);

  return (
    <VendorEventWorkspace
      detail={detail}
      library={library}
      eventUploads={eventUploads}
    />
  );
}
