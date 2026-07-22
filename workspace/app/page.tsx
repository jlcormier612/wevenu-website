import { redirect } from "next/navigation";

import { getActingMember, getSessionMember } from "@/lib/program4/session";
import { permissionsForRole } from "@/lib/program4/permissions";
import { ensureProgram4Data } from "@/lib/program4/store";

export default async function HomePage() {
  await ensureProgram4Data();
  const session = await getSessionMember();
  if (!session) {
    redirect("/login");
  }
  const actor = await getActingMember();
  const permissions = permissionsForRole(actor.role);
  if (permissions.includes("view_business_dashboard")) {
    redirect("/business");
  }
  redirect("/today");
}
