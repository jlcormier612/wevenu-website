import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PaymentAccessShell } from "@/components/portal/payment-access-shell";
import { PortalShell } from "@/components/portal/portal-shell";
import {
  getCouplePortalLegalGateStatus,
  resolveCouplePortalLegalIdentity,
} from "@/lib/legal/service";
import type { CouplePortalLegalGateStatus } from "@/lib/legal/types";
import { resolvePortalContext, resolvePortalTasks, resolvePortalTimeline, resolvePortalVendorTasks } from "@/lib/portal/service";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const ctx = await resolvePortalContext(token);
  if (!ctx) return { title: "Wedding Workspace" };
  if (ctx.accessLevel === "financial") {
    return {
      title: { absolute: `Invoice & Payment Plan — ${ctx.venue.name}` },
      description: `Your invoice and payment plan from ${ctx.venue.name}`,
    };
  }
  const coupleName = [ctx.client.firstName, ctx.client.partnerFirstName].filter(Boolean).join(" & ");
  return {
    title: { absolute: `${coupleName} — ${ctx.venue.name}` },
    description: `Your wedding planning workspace at ${ctx.venue.name}`,
  };
}

async function resolvePortalLegalGate(
  token: string,
): Promise<CouplePortalLegalGateStatus> {
  try {
    const identity = await resolveCouplePortalLegalIdentity(token);
    if (!identity) return { needsAcceptance: true, documents: [] };
    return await getCouplePortalLegalGateStatus(identity);
  } catch (error) {
    console.error("[portal] legal gate resolution failed", error);
    return { needsAcceptance: true, documents: [] };
  }
}

export default async function PortalPage({ params }: Props) {
  const { token } = await params;
  const context = await resolvePortalContext(token);
  if (!context) notFound();

  // Payment access before portal invitation — purpose-built pay experience.
  // Portal layout pins h-svh + overflow-hidden for PortalShell; financial pages
  // need a nested page scroll so the Invoice & Payment Plan schedule is reachable.
  if (context.accessLevel === "financial") {
    return (
      <div className="h-full overflow-y-auto overscroll-contain">
        <PaymentAccessShell token={token} context={context} />
      </div>
    );
  }

  const [tasks, vendorTasks, timeline, legalGate] = await Promise.all([
    resolvePortalTasks(token),
    resolvePortalVendorTasks(token),
    resolvePortalTimeline(token),
    resolvePortalLegalGate(token),
  ]);

  return (
    <PortalShell
      token={token}
      context={context}
      initialTasks={tasks}
      initialVendorTasks={vendorTasks}
      initialTimelineSections={timeline.sections}
      initialTimelineEntries={timeline.entries}
      initialTimelineLastSubmittedAt={timeline.lastSubmittedAt}
      initialTimelineHasUnpublishedChanges={timeline.hasUnpublishedChanges}
      initialLegalGate={legalGate}
    />
  );
}
