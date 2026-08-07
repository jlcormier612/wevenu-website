import { redirect } from "next/navigation";

import { canAccessHqLegalAdmin } from "@/lib/hq/legal-access";
import { getHqAdmin } from "@/lib/hq/service";

/**
 * Owners / Super Admins only for Business → Legal.
 * Team HQ admins remain able to use other /admin routes.
 */
export default async function AdminLegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getHqAdmin();
  if (!canAccessHqLegalAdmin(admin)) {
    redirect("/admin");
  }

  return children;
}
