import { redirect } from "next/navigation";

import { HqShell } from "@/components/hq/hq-shell";
import { getHqAdmin } from "@/lib/hq/service";

/**
 * Gate for Wevenu HQ (/admin/*). Layout-level check, mirrored by a
 * middleware-level check in integrations/supabase/proxy.ts — see
 * docs/wevenu-hq-architecture.md §5 for why both exist.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getHqAdmin();
  if (!admin) redirect("/dashboard");

  return <HqShell>{children}</HqShell>;
}
