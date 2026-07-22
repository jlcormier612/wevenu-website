import { redirect } from "next/navigation";

/** Legacy path — Today's Activity now lives at /today. */
export default function DashboardRedirect() {
  redirect("/today");
}
