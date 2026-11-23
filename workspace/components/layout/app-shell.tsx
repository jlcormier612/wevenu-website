import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { ImpersonateBanner } from "@/components/team/impersonate-controls";
import {
  getNotifications,
  getRelationships,
  getSupportInboxItems,
} from "@/lib/data/store";
import { permissionForPath, permissionsForRole } from "@/lib/program4/permissions";
import {
  getActingMember,
  getSessionMember,
  isImpersonating,
} from "@/lib/program4/session";
import { ensureProgram4Data } from "@/lib/program4/store";
import {
  countOpenSupportItemsAcross,
  relationshipHasOpenSupport,
} from "@/lib/sales-cs";
import { isActionableSupportFeedbackType } from "@shared/relationships";

export async function AppShell({ children }: { children: React.ReactNode }) {
  // warmLiveStore runs once in app/(app)/layout.tsx before this shell.
  await ensureProgram4Data();
  const sessionUser = await getSessionMember();
  if (!sessionUser) {
    // Login page resolves Auth+ACL: staff continue; non-ACL sessions see
    // access-denied (proxy no longer loops /login ↔ /business).
    redirect("/login?reason=no_access");
  }

  const actor = await getActingMember();
  if (!actor) {
    redirect("/login?reason=no_access");
  }
  const impersonating = await isImpersonating();
  const permissions = permissionsForRole(actor.role);
  const unreadNotifications = getNotifications({ unreadOnly: true });
  const unreadCount = unreadNotifications.length;
  const relationships = getRelationships();
  const openSupportRels = relationships.filter(relationshipHasOpenSupport);
  const topBarNotifications = unreadNotifications.slice(0, 8).map((n) => {
    const rel = relationships.find((r) => r.id === n.relationshipId);
    return {
      id: n.id,
      title: n.title,
      body: n.body,
      createdAt: n.createdAt,
      relationshipId: n.relationshipId,
      type: n.type,
      meta: n.meta,
      venueName: rel?.venue.name ?? null,
    };
  });
  // Badge = open actionable venue Get Help / Bug items (not ideas/ratings).
  const openSupportCount = countOpenSupportItemsAcross(openSupportRels);
  const openSupportHref =
    openSupportRels.length === 1
      ? `/relationships/${openSupportRels[0].id}?panel=support&from=customer-success`
      : openSupportRels.length > 1
        ? "/customer-success?stage=needs_support&view=list"
        : "/customer-success?stage=needs_support";
  // Partner Support Inbox — central discovery without opening every relationship.
  const openPartnerSupportCount = getSupportInboxItems({
    surface: "all",
    status: "open",
  }).filter((i) => isActionableSupportFeedbackType(i.type)).length;
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
    <WorkspaceChrome
      homeHref={homeHref}
      sidebar={
        <Sidebar
          unreadCount={unreadCount}
          openSupportCount={openSupportCount}
          openSupportHref={openSupportHref}
          openPartnerSupportCount={openPartnerSupportCount}
          permissions={permissions}
          homeHref={homeHref}
        />
      }
      topBar={
        <TopBar
          actor={actor}
          sessionUser={sessionUser}
          notifications={topBarNotifications}
        />
      }
      banner={
        impersonating ? (
          <ImpersonateBanner realUser={sessionUser} actingAs={actor} />
        ) : null
      }
    >
      {children}
    </WorkspaceChrome>
  );
}
