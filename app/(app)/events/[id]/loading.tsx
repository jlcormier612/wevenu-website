import { HospitalityRouteLoading } from "@/components/shell/hospitality-route-loading";

/** Event URLs redirect into the booking workspace — show the same detail shell meanwhile. */
export default function EventWorkspaceLoading() {
  return <HospitalityRouteLoading variant="detail" label="Opening booking workspace" />;
}
