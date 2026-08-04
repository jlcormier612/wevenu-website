import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { ImpersonateBanner } from "@/components/team/impersonate-controls";
import { getNotifications, getRelationships } from "@/lib/data/store";
import { permissionForPath, permissionsForRole } from "@/lib/program4/permissions";
import {
  getActingMember,
  getSessionMember,
  isImpersonating,
} from "@/lib/program4/session";
import { ensureProgram4Data } from "@/lib/program4/store";

export async function AppShell({ children }: { children: React.ReactNode }) {
  await ensureProgram4Data();
  const sessionUser = await getSessionMember();
  if (!sessionUser) {
    redirect("/login");
  }

  const actor = await getActingMember();
  const impersonating = await isImpersonating();
  const permissions = permissionsForRole(actor.role);
  const unreadCount = getNotifications({ unreadOnly: true }).length;
  const openSupportCount = getRelationships().filter(
    (r) => (r.supportOpenCount || 0) > 0 || r.status === "support",
  ).length;
  const homeHref = permissions.includes("view_business_dashboard")
    ? "/business"
    : "/today";

  const headerList = await headers();
  const pathname =
    headerList.get("x-pathname") ||
    headerList.get("x-url") ||
    headerList.get("next-url") ||
    "";

  if (pathname) {
    const required = permissionForPath(pathname);
    if (required && !permissions.includes(required)) {
      redirect(homeHref);
    }
  }

  return (
    <div className="min-h-screen">
      <Sidebar
        unreadCount={unreadCount}
        openSupportCount={openSupportCount}
        permissions={permissions}
        homeHref={homeHref}
      />
      <div className="pl-[var(--sidebar-width)]">
        {impersonating ? (
          <ImpersonateBanner realUser={sessionUser} actingAs={actor} />
        ) : null}
        <TopBar actor={actor} sessionUser={sessionUser} />
        <main className="ws-enter mx-auto max-w-6xl px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
